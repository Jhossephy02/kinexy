require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const config = require('./src/config');
const { initDatabase } = require('./src/database/connection');

const { profileInput, credentials } = require('./src/middleware-validation');
function createApp(database) {
const app = express();
app.disable('x-powered-by');
if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'no-store'); next(); });
for (const method of ['get', 'post', 'put', 'patch', 'delete']) { const register = app[method].bind(app); app[method] = (path, ...handlers) => register(path, ...handlers.map(handler => (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next))); }
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, config.UPLOAD_DIR),
    filename: (_req, file, callback) => { const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' }; callback(null, `${require('crypto').randomBytes(16).toString('hex')}${extensions[file.mimetype] || ''}`); }
  }),
  limits: { fileSize: config.MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype))
});
function uploadedFileMatchesMime(file) {
  if (!file?.path) return false;
  const buffer = Buffer.alloc(16);
  const descriptor = fs.openSync(file.path, 'r');
  let bytes = 0;
  try { bytes = fs.readSync(descriptor, buffer, 0, buffer.length, 0); } finally { fs.closeSync(descriptor); }
  if (bytes < 4) return false;
  if (file.mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (file.mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') return buffer.subarray(4, 8).toString() === 'ftyp';
  if (file.mimetype === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  return false;
}
const db = database;
const production = config.NODE_ENV === 'production';
const demoOnly = (_req, res, next) => production ? res.status(404).json({ error: 'Ruta no disponible' }) : next();
const requestBuckets = new Map();
const typingStatus = new Map();
const realtimeClients = new Map();
let realtimeClientSequence = 0;
function publishRealtime(event, payload = {}, audience = () => true) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [clientId, client] of realtimeClients) {
    if (!audience(client)) continue;
    try { client.response.write(frame); } catch { realtimeClients.delete(clientId); }
  }
}
app.use((req, res, next) => {
  res.on('finish', () => {
    if (!['POST','PUT','PATCH','DELETE'].includes(req.method) || res.statusCode >= 400 || req.path.startsWith('/api/auth/') || req.path === '/api/messages/typing') return;
    publishRealtime('platform:update', { method: req.method, path: req.path, at: new Date().toISOString() });
  });
  next();
});
function throttle(limit, windowMs) { return (req, res, next) => { const key = `${req.ip}:${req.path}`; const now = Date.now(); const bucket = requestBuckets.get(key); if (!bucket || now - bucket.started >= windowMs) { requestBuckets.set(key, { started: now, count: 1 }); return next(); } if (bucket.count >= limit) return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.' }); bucket.count += 1; next(); }; }
const googleClient = config.GOOGLE_CLIENT_ID ? new OAuth2Client(config.GOOGLE_CLIENT_ID) : null;
for (const key of ['creator_posts', 'creator_sales', 'creator_audience', 'creator_lives', 'creator_live_moderators', 'messages', 'message_unlocks', 'contact_unlocks', 'tips', 'comments', 'profile_reviews', 'post_likes', 'post_unlocks', 'membership_subscriptions', 'creator_publication_subscriptions', 'notifications', 'payments', 'withdrawal_requests']) db[key] ||= [];
const ALL_ROLE_PERMISSIONS = ['moderate_content','resolve_reports','review_payments','view_accounts','approve_profiles','manage_users','manage_roles','manage_system'];
const DEFAULT_ROLE_PERMISSIONS = {
  moderator: ['moderate_content','resolve_reports','review_payments','approve_profiles'],
  admin: ['moderate_content','resolve_reports','review_payments','view_accounts','approve_profiles'],
  superadmin: [...ALL_ROLE_PERMISSIONS]
};
db.role_permissions = { ...DEFAULT_ROLE_PERMISSIONS, ...(db.role_permissions || {}) };
// Uploaded files used by restricted posts must never be served by the public static route.
app.use('/uploads', (req, res, next) => {
  const pathname = `/uploads/${path.basename(req.path)}`;
  if (db.creator_posts.some(post => post.media_url === pathname && post.visibility !== 'public')) return res.status(403).json({ error: 'Archivo privado' });
  next();
}, express.static(config.UPLOAD_DIR, { index: false, fallthrough: true }), (_req, res) => res.status(404).json({ error: 'Archivo no encontrado' }));
const ROLES = new Set(['client', 'creator', 'moderator', 'admin', 'superadmin']);
const TOKEN_PACKS = new Set([40, 80, 180, 460, 900, 1500]);
const TOKEN_METHODS = new Set(['cards', 'yape', 'cash', 'bank', 'paypal', 'crypto']);
const TOKEN_VALUE_PEN = 0.50;
const WITHDRAWAL_VALUE_PEN = 0.30;
const YAPE_PACKS = [{ tokens:40, soles:20 },{ tokens:80, soles:40 },{ tokens:180, soles:90 },{ tokens:460, soles:230 }];
const PUBLICATION_PLANS = [{ id:'basico', name:'Básico', soles:80, benefits:['Anuncio publicado durante 7 días'] },{ id:'destacado', name:'Destacado', soles:120, benefits:['Anuncio publicado durante 7 días','Prioridad sobre anuncios básicos'] },{ id:'premium', name:'Premium', soles:200, benefits:['Anuncio publicado durante 7 días','Máxima prioridad en el listado'] }];
const publicationFor = userId => db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(userId) && new Date(item.expires_at).getTime() > Date.now());
async function publishedProfile(profile) { return profile && (config.BETA_FREE_ACCESS || !profile.owner_id || Boolean(db.mode === 'postgres' ? new Date((await db.getCreatorPublication(profile.owner_id))?.expires_at).getTime() > Date.now() : publicationFor(profile.owner_id))); }
const MESSAGE_UNLOCK_COST = 10;
const MEMBERSHIP_TIERS = { members: 1, members_basic: 1, members_medium: 2, members_high: 3 };
const MEMBERSHIP_COSTS = { 1: 20, 2: 40, 3: 70 };
function subscription(userId) { return [...db.membership_subscriptions].reverse().find(item => Number(item.user_id) === Number(userId) && new Date(item.expires_at).getTime() > Date.now()); }
function canViewPost(post, userId) { if (Number(post.creator_id) === Number(userId) || post.visibility === 'public') return true; if (post.visibility === 'tokens') return ['photo','gallery'].includes(post.type) && db.post_unlocks.some(item => Number(item.user_id) === Number(userId) && Number(item.post_id) === Number(post.id)); return config.BETA_FREE_ACCESS || Boolean(MEMBERSHIP_TIERS[post.visibility] && Number(subscription(userId)?.tier || 0) >= MEMBERSHIP_TIERS[post.visibility]); }
function separateSharedMedia(url) {
  if (!/^\/uploads\/[\w.-]+$/.test(url || '')) return;
  const sharedProfiles = db.profiles?.filter(item => item.photo === url) || [];
  const sharedPosts = db.creator_posts.filter(item => item.media_url === url && item.visibility === 'public');
  if (!sharedProfiles.length && !sharedPosts.length) return;
  const source = path.join(config.UPLOAD_DIR, path.basename(url));
  if (!fs.existsSync(source)) return;
  const copyName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-public${path.extname(source)}`;
  fs.copyFileSync(source, path.join(config.UPLOAD_DIR, copyName));
  for (const profile of sharedProfiles) profile.photo = `/uploads/${copyName}`;
  for (const post of sharedPosts) post.media_url = `/uploads/${copyName}`;
  db.save();
}
for (const post of db.creator_posts.filter(item => item.visibility !== 'public')) separateSharedMedia(post.media_url);
const TOKEN_PRODUCTS = [
  { id: 'exclusive_post', title: 'Publicación exclusiva', description: 'Contenido de muestra disponible en la biblioteca.', cost: 25, icon: 'image' },
  { id: 'private_message', title: 'Mensaje privado', description: 'Prueba el acceso a una conversación individual.', cost: 40, icon: 'message' },
  { id: 'live_access', title: 'Acceso al en vivo', description: 'Entrada de demostración para una transmisión programada.', cost: 60, icon: 'video' },
];
const safeUser = ({ password, ...user }) => ({ ...user, protected_owner: isProtectedOwner(user) });
const validWhatsApp = value => /^\d{8,15}$/.test(String(value || ''));
const validTelegram = value => /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(String(value || ''));
function adultBirthDate(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const born = new Date(`${value}T00:00:00Z`); if (Number.isNaN(born.getTime())) return false; const now = new Date(); let age = now.getUTCFullYear() - born.getUTCFullYear(); if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age -= 1; return age >= 18 && age <= 120; }
function safeProfile(profile) { const { contact_whatsapp, contact_telegram, ...publicProfile } = profile; return { ...publicProfile, contact_whatsapp_enabled: validWhatsApp(contact_whatsapp), contact_telegram_enabled: validTelegram(contact_telegram), contact_price_tokens: Number(profile.contact_price_tokens || 10) }; }
function contactAccess(profile, userId, unlockedFromDb = false) { const unlocked = config.BETA_FREE_ACCESS || unlockedFromDb || Number(profile.owner_id) === Number(userId) || db.contact_unlocks.some(item => Number(item.user_id) === Number(userId) && Number(item.profile_id) === Number(profile.id)); const channels = { whatsapp: validWhatsApp(profile.contact_whatsapp), telegram: validTelegram(profile.contact_telegram) }; return { unlocked, price_tokens: config.BETA_FREE_ACCESS ? 0 : Number(profile.contact_price_tokens || 10), beta_free: config.BETA_FREE_ACCESS, channels, links: unlocked ? { ...(channels.whatsapp ? { whatsapp: `https://wa.me/${profile.contact_whatsapp}` } : {}), ...(channels.telegram ? { telegram: `https://t.me/${profile.contact_telegram}` } : {}) } : {} }; }
const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
async function findUser(email) { const normalized = String(email || '').trim().toLowerCase(); return db.mode === 'postgres' ? db.findUser(normalized) : db.users.find((user) => String(user.email || '').trim().toLowerCase() === normalized); }
async function getUser(id) { return db.mode === 'postgres' ? db.getUser(id) : db.users.find((user) => Number(user.id) === Number(id)); }
const isProtectedOwner = value => String(typeof value === 'object' ? value?.email : value || '').trim().toLowerCase() === config.OWNER_SUPERADMIN_EMAIL;
async function ensureOwnerRole(user) {
  if (!user || !isProtectedOwner(user) || user.role === 'superadmin') return user;
  if (db.mode === 'postgres') return db.updateUserRole(user.id, 'superadmin');
  user.role = 'superadmin'; await db.save(); return user;
}
async function auth(req, res, next) { const value = req.headers.authorization || ''; let payload; try { if (!value.startsWith('Bearer ')) throw new Error('Invalid authorization'); payload = jwt.verify(value.slice(7), config.JWT_SECRET); } catch { return res.status(401).json({ error: 'Autenticación requerida' }); } const user = await getUser(payload.id); if (!user) return res.status(401).json({ error: 'La cuenta ya no está disponible' }); req.auth = { id: user.id, role: user.role }; next(); }
app.get('/api/events', auth, (req, res) => {
  res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  const clientId = ++realtimeClientSequence;
  realtimeClients.set(clientId, { response: res, userId: Number(req.auth.id), role: req.auth.role });
  res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  const heartbeat = setInterval(() => { try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {} }, 20000);
  req.on('close', () => { clearInterval(heartbeat); realtimeClients.delete(clientId); });
});
function role(...roles) { return (req, res, next) => roles.includes(req.auth.role) ? next() : res.status(403).json({ error: 'No tienes permisos para esta operación' }); }
function permission(name) { return (req, res, next) => {
  if (req.auth.role === 'superadmin') return next();
  const granted = db.role_permissions?.[req.auth.role] || [];
  return granted.includes(name) ? next() : res.status(403).json({ error: 'El superadministrador desactivó este permiso para tu rol.' });
}; }
async function notifyStaff(type, title, body) {
  const users = db.mode === 'postgres' ? await db.listUsers() : db.users;
  for (const user of users.filter(item => ['moderator','admin','superadmin'].includes(item.role))) notify(user.id, type, title, body);
}
async function countRole(value) { return db.mode === 'postgres' ? db.countRole(value) : db.users.filter(user => user.role === value).length; }
function jsonWallet(userId) { let wallet = db.token_wallets.find(item => Number(item.user_id) === Number(userId)); if (!wallet) { wallet = { user_id: Number(userId), balance: 0, updated_at: new Date().toISOString() }; db.token_wallets.push(wallet); } return wallet; }
function jsonTransferTokens(senderId, recipientId, amount, type, description) { const sender = jsonWallet(senderId); if (sender.balance < amount) return null; const recipient = jsonWallet(recipientId); const createdAt = new Date().toISOString(); sender.balance -= amount; sender.updated_at = createdAt; recipient.balance += amount; recipient.updated_at = createdAt; db.token_transactions.push({ id: db.nextId(db.token_transactions), user_id: senderId, amount: -amount, type, description, reference: `user:${recipientId}`, created_at: createdAt }); db.token_transactions.push({ id: db.nextId(db.token_transactions), user_id: recipientId, amount, type: `${type}_received`, description: `Recibido: ${description}`, reference: `user:${senderId}`, created_at: createdAt }); notify(recipientId, type, 'Nueva actividad de tokens', description); return { sender, recipient, createdAt }; }
function notify(userId, type, title, body) { db.notifications.push({ id: db.nextId(db.notifications), user_id: Number(userId), type, title, body, read: false, created_at: new Date().toISOString() }); }
function managedAccountInput(req, res, next) {
  const { name, email, password, role: requestedRole } = req.body || {};
  const invalid = typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || !email.trim() || email.length > 254 || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 || !ROLES.has(requestedRole);
  if (invalid) return res.status(400).json({ error: 'Completa nombre, usuario, contraseña de 8 caracteres y un rol válido' });
  req.body = { name: name.trim(), email: email.trim(), password, role: requestedRole };
  next();
}
function membershipInput(req, res, next) {
  const { name, price, currency = 'PEN', description = '', benefits = [] } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.length > 60 || typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10000 || !['PEN', 'USD'].includes(currency) || typeof description !== 'string' || description.length > 500 || !Array.isArray(benefits) || benefits.length > 8 || benefits.some(item => typeof item !== 'string' || !item.trim() || item.length > 100)) return res.status(400).json({ error: 'Los datos de la membresía no son válidos' });
  req.body = { name: name.trim(), price, currency, description: description.trim(), benefits: benefits.map(item => item.trim()) };
  next();
}
function creatorPostInput(req, res, next) {
  const { title, caption = '', type = 'photo', visibility = 'public', price_tokens = 0, media_url = '', status = 'draft' } = req.body || {};
  const privatePhoto = ['photo','gallery','video'].includes(type) && visibility !== 'public';
  const invalid = typeof title !== 'string' || !title.trim() || title.length > 100 || typeof caption !== 'string' || caption.length > 1000 || !['photo','gallery','video','text'].includes(type) || !['public','members','members_basic','members_medium','members_high','tokens'].includes(visibility) || !Number.isInteger(Number(price_tokens)) || Number(price_tokens) < 0 || Number(price_tokens) > 10000 || (visibility === 'tokens' && (Number(price_tokens) < 1 || !['photo','gallery'].includes(type))) || typeof media_url !== 'string' || media_url.length > 500 || (privatePhoto && (!/^\/uploads\/[\w.-]+$/.test(media_url) || !fs.existsSync(path.join(config.UPLOAD_DIR, path.basename(media_url))))) || !['draft','published'].includes(status);
  if (invalid) return res.status(400).json({ error: 'Los datos de la publicación no son válidos' });
  req.body = { title: title.trim(), caption: caption.trim(), type, visibility, price_tokens: visibility === 'tokens' ? Number(price_tokens) : 0, media_url: media_url.trim(), status };
  next();
}
function creatorSnapshot(creatorId) {
  const posts = db.creator_posts.filter(item => Number(item.creator_id) === Number(creatorId)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const sales = db.creator_sales.filter(item => Number(item.creator_id) === Number(creatorId)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const audience = db.creator_audience.filter(item => Number(item.creator_id) === Number(creatorId));
  const moderators = db.creator_live_moderators.filter(item => Number(item.creator_id) === Number(creatorId));
  const live = [...db.creator_lives].reverse().find(item => Number(item.creator_id) === Number(creatorId) && item.status !== 'ended') || null;
  const totals = posts.reduce((sum, post) => ({ views: sum.views + Number(post.views || 0), likes: sum.likes + Number(post.likes || 0), purchases: sum.purchases + Number(post.purchases || 0), revenue_tokens: sum.revenue_tokens + Number(post.revenue_tokens || 0) }), { views: 0, likes: 0, purchases: 0, revenue_tokens: 0 });
  const scale = [0.48,0.62,0.57,0.76,0.68,0.91,1];
  const analytics = scale.map((factor,index) => ({ day: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][index], views: Math.round((totals.views || 1250) * factor / 4), likes: Math.round((totals.likes || 210) * factor / 4) }));
  return { posts, sales, audience, moderators, live, analytics, stats: { ...totals, posts: posts.length, published: posts.filter(item => item.status === 'published').length, available_tokens: Math.round(totals.revenue_tokens * .8), pending_tokens: Math.round(totals.revenue_tokens * .2) } };
}

app.post('/api/auth/login', throttle(10, 60000), credentials, async (req, res) => { let user = await findUser(req.body?.email); if (!user || !(user.password.startsWith('$2') ? await bcrypt.compare(req.body.password, user.password) : user.password === req.body.password)) return res.status(401).json({ error: 'Credenciales inválidas' }); user = await ensureOwnerRole(user); res.json({ token: tokenFor(user), user: safeUser(user) }); });
app.post('/api/auth/register', throttle(5, 60000), credentials, async (req, res) => { const { name, email, password, date_of_birth } = req.body || {}; if (isProtectedOwner(email)) return res.status(403).json({ error: 'La cuenta propietaria debe ingresar con Google o con la credencial configurada en el servidor.' }); if (await findUser(email)) return res.status(409).json({ error: 'El usuario ya está registrado' }); const publicRole = process.env.CREATOR_ACTIVATION_FREE !== 'false' && req.body.role === 'creator' ? 'creator' : 'client'; const adultConfirmedAt = new Date().toISOString(); const user = db.mode === 'postgres' ? await db.createUser({ name, email, password: await bcrypt.hash(password, 10), role: publicRole, date_of_birth }) : { id: db.nextId(db.users), name: name.trim(), email, password: await bcrypt.hash(password, 10), role: publicRole, date_of_birth, adult_confirmed_at: adultConfirmedAt, created_at: adultConfirmedAt }; if (db.mode !== 'postgres') { db.users.push(user); db.save(); } res.status(201).json({ token: tokenFor(user), user: safeUser(user) }); });
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'El acceso con Google aún no está configurado.' });
  const credential = req.body?.credential;
  const publicRole = process.env.CREATOR_ACTIVATION_FREE !== 'false' && req.body?.role === 'creator' ? 'creator' : 'client';
  if (typeof credential !== 'string' || credential.length > 5000) return res.status(400).json({ error: 'La credencial de Google no es válida.' });
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch { return res.status(401).json({ error: 'No se pudo verificar la identidad de Google.' }); }
  if (!payload?.email || !payload.email_verified) return res.status(403).json({ error: 'Google debe confirmar un correo electrónico verificado.' });
  let user = await findUser(payload.email);
  if (!user) {
    if (!adultBirthDate(req.body?.date_of_birth)) return res.status(403).json({ error: 'Solo pueden registrarse personas de 18 años o más.' });
    if (req.body?.accepted_terms !== true || req.body?.accepted_privacy !== true) return res.status(400).json({ error: 'Debes aceptar los términos y la política de privacidad.' });
    const generatedPassword = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
    const name = String(payload.name || payload.given_name || payload.email.split('@')[0]).slice(0, 100);
    const assignedRole = isProtectedOwner(payload.email) ? 'superadmin' : publicRole;
    user = db.mode === 'postgres'
      ? await db.createUser({ name, email: payload.email.toLowerCase(), password: generatedPassword, role: assignedRole, date_of_birth: req.body.date_of_birth })
      : { id: db.nextId(db.users), name, email: payload.email.toLowerCase(), password: generatedPassword, role: assignedRole, date_of_birth: req.body.date_of_birth, adult_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
    if (db.mode !== 'postgres') { db.users.push(user); db.save(); }
  }
  user = await ensureOwnerRole(user);
  res.json({ token: tokenFor(user), user: safeUser(user) });
});
app.get('/api/auth/me', auth, async (req, res) => { const user = await getUser(req.auth.id); if (!user) return res.status(404).json({ error: 'Usuario no encontrado' }); res.json({ user: safeUser(user) }); });

app.post('/api/user/become-creator', auth, async (req, res) => {
  const user = await getUser(req.auth.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.role === 'creator') return res.json({ user: safeUser(user), token: tokenFor(user) });
  if (user.role !== 'client') return res.status(403).json({ error: 'Esta cuenta no puede cambiar su rol a creador.' });

  if (process.env.CREATOR_ACTIVATION_FREE !== 'false') {
    if (req.body?.method && req.body.method !== 'free' && req.body.method !== 'tokens') return res.status(400).json({ error: 'Método de activación inválido' });
    const promoted = db.mode === 'postgres' ? await db.updateUserRole(req.auth.id, 'creator') : user;
    if (db.mode !== 'postgres') { promoted.role = 'creator'; db.save(); }
    return res.json({ user: safeUser(promoted), token: tokenFor(promoted), free_activation: true });
  }

  const paymentMethod = req.body?.method || 'tokens';
  if (paymentMethod !== 'tokens') return res.status(400).json({ error: 'La activación solo está disponible con 100 tokens.' });

  {
    // La activación requiere un débito real en la billetera del usuario.
    const CREATOR_COST = 100;
    let wallet = db.mode === 'postgres' ? await db.getTokenWallet(req.auth.id) : db.token_wallets.find(item => Number(item.user_id) === Number(req.auth.id));
    
    const balance = wallet ? wallet.balance : 0;
    if (balance < CREATOR_COST) {
      return res.status(409).json({ error: `Saldo insuficiente. Necesitas ${CREATOR_COST} tokens para activar tu perfil de Creador. Tu saldo actual es de ${balance} tokens.` });
    }

    if (db.mode === 'postgres') {
      await db.spendTokens(req.auth.id, { id: 'creator_activation', title: 'Activación de perfil de Creador', cost: CREATOR_COST });
    } else {
      wallet.balance -= CREATOR_COST;
      wallet.updated_at = new Date().toISOString();
      db.token_transactions.push({
        id: db.nextId(db.token_transactions),
        user_id: req.auth.id,
        amount: -CREATOR_COST,
        type: 'creator_activation',
        description: 'Activación de membresía y perfil de Creador con tokens',
        reference: 'creator_activation',
        created_at: new Date().toISOString()
      });
    }
  }

  const promoted = db.mode === 'postgres' ? await db.updateUserRole(req.auth.id, 'creator') : user;
  if (db.mode !== 'postgres') { promoted.role = 'creator'; db.save(); }
  res.json({ user: safeUser(promoted), token: tokenFor(promoted) });
});

app.get('/api/profiles', async (req, res) => { const profiles = db.mode === 'postgres' ? await db.listProfiles({ ...req.query, betaFree: config.BETA_FREE_ACCESS }) : db.profiles.filter((p) => (!req.query.city || p.city === req.query.city) && (!req.query.category || req.query.category === 'Todos' || p.category === req.query.category) && p.approved && p.active && (config.BETA_FREE_ACCESS || !p.owner_id || publicationFor(p.owner_id))); const ranked = db.mode === 'postgres' ? profiles : profiles.map(p => ({ ...p, plan: publicationFor(p.owner_id)?.plan || p.plan })).sort((a,b) => ({premium:0,destacado:1,basico:2}[a.plan] ?? 2) - ({premium:0,destacado:1,basico:2}[b.plan] ?? 2)); res.json({ profiles: ranked.map(safeProfile), beta_free: config.BETA_FREE_ACCESS }); });
app.get('/api/profiles/:id', async (req, res) => { const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find((p) => String(p.id) === req.params.id); if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' }); res.json({ profile: safeProfile(profile) }); });
app.get('/api/profiles/:id/reviews', async (req, res) => {
  const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find(item => Number(item.id) === Number(req.params.id));
  if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' });
  const reviews = db.profile_reviews.filter(item => Number(item.profile_id) === Number(profile.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(item => ({ ...item, author_name: db.users.find(user => Number(user.id) === Number(item.user_id))?.name || 'Usuario' }));
  const average = reviews.length ? Math.round(reviews.reduce((sum, item) => sum + Number(item.rating), 0) * 10 / reviews.length) / 10 : 0;
  res.json({ reviews, summary: { average, count: reviews.length } });
});
app.post('/api/profiles/:id/reviews', auth, throttle(5, 60000), async (req, res) => {
  const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find(item => Number(item.id) === Number(req.params.id));
  const rating = Number(req.body?.rating); const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' });
  if (Number(profile.owner_id) === Number(req.auth.id)) return res.status(409).json({ error: 'No puedes opinar sobre tu propio perfil.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 10 || text.length > 800) return res.status(400).json({ error: 'Elige de 1 a 5 estrellas y escribe al menos 10 caracteres.' });
  let review = db.profile_reviews.find(item => Number(item.profile_id) === Number(profile.id) && Number(item.user_id) === Number(req.auth.id));
  if (review) Object.assign(review, { rating, text, updated_at: new Date().toISOString() });
  else { review = { id: db.nextId(db.profile_reviews), profile_id: profile.id, user_id: req.auth.id, rating, text, created_at: new Date().toISOString() }; db.profile_reviews.push(review); }
  notify(profile.owner_id, 'profile_review', 'Nueva opinión en tu anuncio', `${(await getUser(req.auth.id)).name} dejó una opinión.`);
  await db.save(); res.status(review.updated_at ? 200 : 201).json({ review });
});
app.post('/api/profiles/:id/reports', auth, throttle(5, 60000), async (req, res) => {
  const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find(item => Number(item.id) === Number(req.params.id));
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''; const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' });
  if (Number(profile.owner_id) === Number(req.auth.id)) return res.status(409).json({ error: 'No puedes reportar tu propio perfil.' });
  if (reason.length < 3 || reason.length > 80 || details.length > 800) return res.status(400).json({ error: 'Selecciona un motivo válido y limita el detalle a 800 caracteres.' });
  if (db.moderation_reports.some(item => Number(item.profile_id) === Number(profile.id) && Number(item.reporter_id) === Number(req.auth.id) && ['open','reviewing'].includes(item.status))) return res.status(409).json({ error: 'Tu reporte sobre este perfil ya está en revisión.' });
  const input = { profileId: profile.id, reporterId: req.auth.id, reason, details, priority: reason === 'Riesgo o seguridad' ? 'high' : 'medium' };
  const report = db.mode === 'postgres' ? await db.createModerationReport(input) : { id: db.nextId(db.moderation_reports), profile_id: profile.id, reporter_id: req.auth.id, reason, details, priority: input.priority, status: 'open', created_at: new Date().toISOString() };
  if (db.mode !== 'postgres') { db.moderation_reports.push(report); await db.save(); }
  res.status(201).json({ report });
});
app.get('/api/profiles/:id/contact', auth, async (req, res) => { const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find(item => Number(item.id) === Number(req.params.id)); if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' }); const stored = db.mode === 'postgres' ? await db.getContactUnlock(req.auth.id, profile.id) : null; res.json(contactAccess(profile, req.auth.id, Boolean(stored))); });
app.post('/api/profiles/:id/contact/unlock', auth, throttle(10, 60000), async (req, res) => {
  const profile = db.mode === 'postgres' ? await db.getProfile(req.params.id) : db.profiles.find(item => Number(item.id) === Number(req.params.id));
  if (!profile || !profile.approved || !profile.active || !(await publishedProfile(profile))) return res.status(404).json({ error: 'Perfil no encontrado' });
  if (!profile.owner_id || (!validWhatsApp(profile.contact_whatsapp) && !validTelegram(profile.contact_telegram))) return res.status(409).json({ error: 'Este creador aún no habilitó WhatsApp ni Telegram.' });
  const stored = db.mode === 'postgres' ? await db.getContactUnlock(req.auth.id, profile.id) : null;
  if (contactAccess(profile, req.auth.id, Boolean(stored)).unlocked) return res.json(contactAccess(profile, req.auth.id, Boolean(stored)));
  const amount = Number(profile.contact_price_tokens || 10);
  const transfer = db.mode === 'postgres' ? await db.unlockContact(req.auth.id, profile) : jsonTransferTokens(req.auth.id, profile.owner_id, amount, 'contact_unlock', `Contacto de ${profile.name}`);
  if (!transfer) return res.status(409).json({ error: `Necesitas ${amount} tokens para desbloquear este contacto.` });
  if (!transfer.already_unlocked) { db.contact_unlocks.push(db.mode === 'postgres' ? transfer.unlock : { id: db.nextId(db.contact_unlocks), user_id: req.auth.id, profile_id: profile.id, created_at: transfer.createdAt }); await db.save(); }
  res.status(transfer.already_unlocked ? 200 : 201).json({ ...contactAccess(profile, req.auth.id, true), wallet: { balance: db.mode === 'postgres' ? transfer.wallet.balance : transfer.sender.balance } });
});
app.get('/api/advertiser/profiles', auth, role('creator', 'admin', 'superadmin'), async (req, res) => { const profiles = db.mode === 'postgres' ? await db.listOwnerProfiles(req.auth.id) : db.profiles.filter((p) => Number(p.owner_id) === Number(req.auth.id)); res.json({ profiles }); });
function profileMediaExists(input) {
  const urls = [...new Set([input.photo, ...(Array.isArray(input.photos) ? input.photos : [])].filter(Boolean))];
  return urls.length > 0 && urls.every(url => /^\/uploads\/[\w.-]+$/.test(url) && fs.existsSync(path.join(config.UPLOAD_DIR, path.basename(url))));
}
app.post('/api/profiles', auth, role('creator', 'admin', 'superadmin'), profileInput, async (req, res) => { if (production && !profileMediaExists(req.body)) return res.status(409).json({ error: 'Carga al menos una foto válida antes de enviar el perfil.' }); const canApprove = ['admin', 'superadmin'].includes(req.auth.role); const profile = db.mode === 'postgres' ? await db.createProfile(req.body, req.auth.id, canApprove) : { ...req.body, owner_id: req.auth.id, id: db.nextId(db.profiles), active: true, approved: canApprove }; if (db.mode !== 'postgres') db.profiles.push(profile); if (!canApprove) await notifyStaff('profile_pending', 'Nuevo perfil pendiente', `${profile.name} envió un anuncio para revisión.`); await db.save(); res.status(201).json({ profile, review_status: canApprove ? 'approved' : 'pending' }); });
app.put('/api/profiles/:id', auth, role('creator', 'admin', 'superadmin'), profileInput, async (req, res) => { const staff = ['admin', 'superadmin'].includes(req.auth.role); const profile = db.mode === 'postgres' ? await db.updateProfile(req.params.id, req.body, staff ? null : req.auth.id) : db.profiles.find((p) => String(p.id) === req.params.id && (staff || Number(p.owner_id) === Number(req.auth.id))); if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' }); if (db.mode !== 'postgres') { Object.assign(profile, req.body); db.save(); } res.json({ profile }); });
app.patch('/api/profiles/:id/approve', auth, role('moderator', 'admin', 'superadmin'), permission('approve_profiles'), async (req, res) => { if (typeof req.body?.approved !== 'boolean') return res.status(400).json({ error: 'La aprobación debe ser true o false' }); const profile = db.mode === 'postgres' ? await db.approveProfile(req.params.id, req.body.approved) : db.profiles.find((p) => String(p.id) === req.params.id); if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' }); const action = req.body.approved ? 'profile_approved' : 'profile_rejected'; if (db.mode === 'postgres') await db.logModerationAction(req.auth.id, 'profile', profile.id, action); else { profile.approved = req.body.approved; db.moderation_actions.push({ id: db.nextId(db.moderation_actions), moderator_id: req.auth.id, target_type: 'profile', target_id: profile.id, action, note: '', created_at: new Date().toISOString() }); } notify(profile.owner_id, action, req.body.approved ? 'Tu perfil fue aprobado' : 'Tu perfil fue rechazado', req.body.approved ? 'Tu anuncio ya superó la revisión.' : 'Revisa la información de tu anuncio antes de enviarlo otra vez.'); await db.save(); res.json({ profile }); });

app.get('/api/permissions/me', auth, (req, res) => res.json({ role: req.auth.role, permissions: req.auth.role === 'superadmin' ? ALL_ROLE_PERMISSIONS : (db.role_permissions?.[req.auth.role] || []) }));
app.get('/api/admin/role-permissions', auth, role('superadmin'), (_req, res) => res.json({ permissions: ALL_ROLE_PERMISSIONS, matrix: db.role_permissions }));
app.patch('/api/admin/role-permissions/:role', auth, role('superadmin'), async (req, res) => {
  const targetRole = req.params.role;
  const { permission: requested, enabled } = req.body || {};
  if (!['moderator','admin'].includes(targetRole) || !ALL_ROLE_PERMISSIONS.includes(requested) || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Rol, permiso o estado inválido.' });
  const current = new Set(db.role_permissions[targetRole] || []);
  enabled ? current.add(requested) : current.delete(requested);
  db.role_permissions[targetRole] = [...current];
  await db.save();
  res.json({ matrix: db.role_permissions });
});
app.get('/api/users', auth, role('admin', 'superadmin'), permission('view_accounts'), async (_req, res) => { const records = db.mode === 'postgres' ? await db.listUsers() : db.users; res.json({ users: records.map(safeUser) }); });
app.post('/api/users', auth, role('superadmin'), managedAccountInput, async (req, res) => { if (await findUser(req.body.email)) return res.status(409).json({ error: 'El usuario ya está registrado' }); const input = { ...req.body, password: await bcrypt.hash(req.body.password, 10) }; const user = db.mode === 'postgres' ? await db.createManagedUser(input) : { ...input, id: db.nextId(db.users), created_at: new Date().toISOString() }; if (db.mode !== 'postgres') { db.users.push(user); db.save(); } res.status(201).json({ user: safeUser(user) }); });
app.patch('/api/users/:id/role', auth, role('superadmin'), async (req, res) => { const nextRole = req.body?.role; if (!ROLES.has(nextRole)) return res.status(400).json({ error: 'Rol inválido' }); const target = await getUser(req.params.id); if (!target) return res.status(404).json({ error: 'Cuenta no encontrada' }); if (Number(target.id) === Number(req.auth.id) && nextRole !== target.role) return res.status(409).json({ error: 'No puedes cambiar el rol de tu propia sesión.' }); if (isProtectedOwner(target) && nextRole !== 'superadmin') return res.status(409).json({ error: 'La cuenta propietaria es un superadministrador protegido.' }); if (target.role === 'superadmin' && nextRole !== 'superadmin' && await countRole('superadmin') <= 1) return res.status(409).json({ error: 'Debe existir al menos un superadministrador' }); const user = db.mode === 'postgres' ? await db.updateUserRole(req.params.id, nextRole) : db.users.find(item => Number(item.id) === Number(req.params.id)); if (db.mode !== 'postgres') { user.role = nextRole; db.save(); } res.json({ user: safeUser(user) }); });
app.delete('/api/users/:id', auth, role('superadmin'), async (req, res) => { if (Number(req.params.id) === Number(req.auth.id)) return res.status(409).json({ error: 'No puedes eliminar tu propia cuenta' }); const target = await getUser(req.params.id); if (!target) return res.status(404).json({ error: 'Cuenta no encontrada' }); if (isProtectedOwner(target)) return res.status(409).json({ error: 'La cuenta propietaria no se puede eliminar.' }); if (target.role === 'superadmin' && await countRole('superadmin') <= 1) return res.status(409).json({ error: 'Debe existir al menos un superadministrador' }); if (db.mode === 'postgres') await db.deleteUser(req.params.id); else { db.users.splice(db.users.findIndex(item => Number(item.id) === Number(req.params.id)), 1); db.save(); } res.status(204).end(); });
app.post('/api/admin/wallet/credit', auth, role('superadmin'), async (req, res) => {
  const userIds = [...new Set(Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number) : [])].filter(Number.isInteger);
  const amount = Number(req.body?.amount);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 140) : '';
  if (!userIds.length || userIds.length > 50 || !Number.isInteger(amount) || amount < 1 || amount > 10000) return res.status(400).json({ error: 'Selecciona hasta 50 cuentas y entre 1 y 10 000 tokens.' });
  const users = await Promise.all(userIds.map(getUser));
  if (users.some(user => !user)) return res.status(404).json({ error: 'Una de las cuentas seleccionadas ya no existe.' });
  const results = [];
  for (const target of users) {
    if (db.mode === 'postgres') { results.push(await db.creditDemoTokens(target.id, amount, 'admin_grant')); continue; }
    let wallet = db.token_wallets.find(item => Number(item.user_id) === Number(target.id));
    if (!wallet) { wallet = { user_id: target.id, balance: 0, updated_at: new Date().toISOString() }; db.token_wallets.push(wallet); }
    wallet.balance += amount; wallet.updated_at = new Date().toISOString();
    db.token_transactions.push({ id: db.nextId(db.token_transactions), user_id: target.id, amount, type: 'admin_credit', description: `Acreditación de superadmin${note ? `: ${note}` : ''}`, reference: `admin:${req.auth.id}`, created_at: new Date().toISOString() });
    results.push({ wallet: { balance: wallet.balance, updated_at: wallet.updated_at } });
  }
  if (db.mode !== 'postgres') db.save();
  res.status(201).json({ credited: users.map(user => ({ id: user.id, name: user.name, email: user.email })), amount });
});
app.get('/api/membership-plans', async (_req, res) => { const plans = db.mode === 'postgres' ? await db.listMembershipPlans() : db.membership_plans.filter(plan => plan.active); res.json({ plans, payments_enabled: false, beta_free: config.BETA_FREE_ACCESS }); });
app.post('/api/membership-plans', auth, role('creator', 'admin', 'superadmin'), membershipInput, async (req, res) => { const creatorId = req.auth.role === 'creator' ? req.auth.id : null; const plan = db.mode === 'postgres' ? await db.createMembershipPlan(req.body, creatorId) : { ...req.body, id: db.nextId(db.membership_plans), creator_id: creatorId, active: true }; if (db.mode !== 'postgres') { db.membership_plans.push(plan); db.save(); } res.status(201).json({ plan }); });
app.get('/api/membership/me', auth, (req, res) => res.json({ subscription: subscription(req.auth.id) || null, costs: config.BETA_FREE_ACCESS ? { 1:0, 2:0, 3:0 } : MEMBERSHIP_COSTS, beta_free: config.BETA_FREE_ACCESS }));
app.post('/api/membership/subscribe', auth, async (req, res) => {
  const tier = Number(req.body?.tier);
  if (![1, 2, 3].includes(tier)) return res.status(400).json({ error: 'Nivel de membresía inválido' });
  const current = subscription(req.auth.id);
  if (current && current.tier >= tier) return res.status(409).json({ error: 'Ya tienes ese nivel o uno superior activo' });
  const cost = MEMBERSHIP_COSTS[tier];
  if (config.BETA_FREE_ACCESS) {
    const record = { id: db.nextId(db.membership_subscriptions), user_id: req.auth.id, tier, started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), beta_free: true };
    db.membership_subscriptions.push(record); await db.save();
    return res.status(201).json({ subscription: record, wallet: { balance: (db.mode === 'postgres' ? await db.getTokenWallet(req.auth.id) : jsonWallet(req.auth.id)).balance }, beta_free: true });
  }
  let wallet;
  if (db.mode === 'postgres') {
    const debit = await db.debitTokens(req.auth.id, cost, 'membership_subscription', `Membresía nivel ${tier}`, `membership:${tier}:${Date.now()}`);
    if (!debit) return res.status(409).json({ error: 'Saldo de tokens insuficiente' });
    wallet = debit.wallet;
  } else {
    wallet = jsonWallet(req.auth.id);
    if (wallet.balance < cost) return res.status(409).json({ error: 'Saldo de tokens insuficiente' });
    wallet.balance -= cost; wallet.updated_at = new Date().toISOString();
  }
  const record = { id: db.nextId(db.membership_subscriptions), user_id: req.auth.id, tier, started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString() };
  db.membership_subscriptions.push(record);
  if (db.mode !== 'postgres') db.token_transactions.push({ id: db.nextId(db.token_transactions), user_id: req.auth.id, amount: -cost, type: 'membership_subscription', description: `Membresía nivel ${tier}`, reference: `membership:${record.id}`, created_at: record.started_at });
  await db.save();
  res.status(201).json({ subscription: record, wallet: { balance: wallet.balance } });
});
app.get('/api/creator/studio', auth, role('creator'), async (req, res) => res.json(creatorSnapshot(req.auth.id)));
app.post('/api/uploads/image', auth, role('creator', 'admin', 'superadmin'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen JPG, PNG o WEBP, o un video MP4, WEBM o MOV de hasta 8 MB.' });
  if (!uploadedFileMatchesMime(req.file)) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(415).json({ error: 'El contenido del archivo no coincide con su formato.' }); }
  res.status(201).json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
});
app.post('/api/creator/posts', auth, role('creator'), creatorPostInput, async (req, res) => { if (req.body.visibility !== 'public') separateSharedMedia(req.body.media_url); const post = { ...req.body, id: db.nextId(db.creator_posts), creator_id: req.auth.id, views: 0, likes: 0, purchases: 0, revenue_tokens: 0, created_at: new Date().toISOString() }; db.creator_posts.push(post); await db.save(); res.status(201).json({ post, studio: creatorSnapshot(req.auth.id) }); });
app.get('/api/creator/posts/:creatorId', async (req, res) => { const creatorId = Number(req.params.creatorId); const creator = await getUser(creatorId); if (!creator || creator.role !== 'creator' || (!config.BETA_FREE_ACCESS && !(db.mode === 'postgres' ? new Date((await db.getCreatorPublication(creatorId))?.expires_at).getTime() > Date.now() : publicationFor(creatorId)))) return res.status(404).json({ error: 'Creador no encontrado' }); let viewerId = null; try { const authorization = req.headers.authorization || ''; if (authorization.startsWith('Bearer ')) viewerId = jwt.verify(authorization.slice(7), config.JWT_SECRET).id; } catch {} const posts = db.creator_posts.filter(post => Number(post.creator_id) === creatorId && post.status === 'published').sort((a,b) => Number(b.id) - Number(a.id)).map(post => { const locked = !canViewPost(post, viewerId); return { ...post, locked, likes: Number(post.likes || 0), comments_count: db.comments.filter(comment => Number(comment.post_id) === Number(post.id)).length, media_url: locked ? '' : post.visibility === 'public' ? post.media_url : `/api/creator/posts/${post.id}/media` }; }); res.json({ creator: safeUser(creator), posts }); });
app.get('/api/creator/posts/:id/media', auth, (req, res) => {
  const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id));
  if (!post || (post.status !== 'published' && Number(post.creator_id) !== Number(req.auth.id))) return res.status(404).json({ error: 'Publicación no disponible' });
  if (!canViewPost(post, req.auth.id)) return res.status(403).json({ error: 'Desbloquea esta publicación primero' });
  if (!/^\/uploads\/[\w.-]+$/.test(post.media_url || '')) return res.status(404).json({ error: 'Archivo no disponible' });
  res.sendFile(path.basename(post.media_url), { root: config.UPLOAD_DIR, dotfiles: 'deny' });
});
app.post('/api/creator/posts/:id/unlock', auth, async (req, res) => {
  const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id) && item.status === 'published');
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (!config.BETA_FREE_ACCESS && !(db.mode === 'postgres' ? new Date((await db.getCreatorPublication(post.creator_id))?.expires_at).getTime() > Date.now() : publicationFor(post.creator_id))) return res.status(404).json({ error:'Publicación no disponible' });
  if (post.visibility !== 'tokens' || !['photo','gallery'].includes(post.type)) return res.status(400).json({ error: 'Solo las fotos y galerías exclusivas se compran con tokens' });
  if (['photo', 'gallery', 'video'].includes(post.type) && (!/^\/uploads\/[\w.-]+$/.test(post.media_url || '') || !fs.existsSync(path.join(config.UPLOAD_DIR, path.basename(post.media_url))))) return res.status(409).json({ error: 'El archivo no está disponible. No se descontaron tokens.' });
  if (canViewPost(post, req.auth.id)) return res.json({ already_unlocked: true, post_id: post.id });
  const amount = Number(post.price_tokens);
  const transfer = db.mode === 'postgres' ? await db.unlockPost(req.auth.id, post) : jsonTransferTokens(req.auth.id, post.creator_id, amount, 'post_unlock', `Compra de ${post.title}`);
  if (!transfer) return res.status(409).json({ error: 'Saldo de tokens insuficiente' });
  if (transfer.already_unlocked) return res.json({ already_unlocked: true, post_id: post.id, wallet: transfer.wallet });
  const record = db.mode === 'postgres' ? transfer.unlock : { id: db.nextId(db.post_unlocks), user_id: req.auth.id, post_id: post.id, created_at: transfer.createdAt };
  db.post_unlocks.push(record);
  post.purchases = Number(post.purchases || 0) + 1; post.revenue_tokens = Number(post.revenue_tokens || 0) + amount;
  db.creator_sales.push({ id: db.nextId(db.creator_sales), creator_id: post.creator_id, post_id: post.id, buyer: (await getUser(req.auth.id)).name, amount_tokens: amount, created_at: transfer.createdAt || record.created_at });
  await db.save();
  res.status(201).json({ unlocked: true, post_id: post.id, wallet: { balance: db.mode === 'postgres' ? transfer.wallet.balance : transfer.sender.balance } });
});
app.get('/api/creator/posts/:id/comments', async (req, res) => {
  const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id) && item.status === 'published');
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  const comments = db.comments.filter(item => Number(item.post_id) === Number(post.id)).map(item => ({ ...item, author: db.users.find(user => Number(user.id) === Number(item.user_id))?.name || 'Usuario' }));
  res.json({ comments });
});
app.post('/api/creator/posts/:id/comments', auth, async (req, res) => {
  const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id) && item.status === 'published');
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (!canViewPost(post, req.auth.id)) return res.status(403).json({ error: 'Desbloquea la publicación para comentar' });
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 1000) return res.status(400).json({ error: 'El comentario debe tener entre 1 y 1000 caracteres' });
  const comment = { id: db.nextId(db.comments), post_id: post.id, user_id: req.auth.id, text, created_at: new Date().toISOString() };
  db.comments.push(comment); notify(post.creator_id, 'comment', 'Nuevo comentario', `Alguien comentó en “${post.title}”.`); await db.save();
  res.status(201).json({ comment: { ...comment, author: (await getUser(req.auth.id)).name } });
});
app.delete('/api/comments/:id', auth, async (req, res) => {
  const index = db.comments.findIndex(item => Number(item.id) === Number(req.params.id));
  if (index < 0) return res.status(404).json({ error: 'Comentario no encontrado' });
  const comment = db.comments[index];
  if (Number(comment.user_id) !== Number(req.auth.id) && !['moderator','admin','superadmin'].includes(req.auth.role)) return res.status(403).json({ error: 'No tienes permisos para eliminar este comentario' });
  db.comments.splice(index, 1); await db.save(); res.json({ deleted: true });
});
app.get('/api/creator/posts/:id/likes', auth, async (req, res) => { const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Publicación no encontrada' }); res.json({ liked: db.post_likes.some(item => Number(item.post_id) === post.id && Number(item.user_id) === Number(req.auth.id)), count: Number(post.likes || 0) }); });
app.post('/api/creator/posts/:id/likes', auth, async (req, res) => { const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id) && item.status === 'published'); if (!post) return res.status(404).json({ error: 'Publicación no encontrada' }); if (!canViewPost(post, req.auth.id)) return res.status(403).json({ error: 'Desbloquea la publicación para interactuar' }); const index = db.post_likes.findIndex(item => Number(item.post_id) === post.id && Number(item.user_id) === Number(req.auth.id)); if (index >= 0) { db.post_likes.splice(index, 1); post.likes = Math.max(0, Number(post.likes || 0) - 1); await db.save(); return res.json({ liked: false, count: post.likes }); } db.post_likes.push({ id: db.nextId(db.post_likes), post_id: post.id, user_id: req.auth.id, created_at: new Date().toISOString() }); post.likes = Number(post.likes || 0) + 1; notify(post.creator_id, 'like', 'Nuevo me gusta', `Tu publicación “${post.title}” recibió un me gusta.`); await db.save(); res.json({ liked: true, count: post.likes }); });
app.patch('/api/creator/posts/:id', auth, role('creator'), async (req, res) => { const post = db.creator_posts.find(item => Number(item.id) === Number(req.params.id) && Number(item.creator_id) === Number(req.auth.id)); if (!post) return res.status(404).json({ error: 'Publicación no encontrada' }); const { status, title, caption, visibility, price_tokens } = req.body || {}; if (status !== undefined && !['draft','published','archived'].includes(status)) return res.status(400).json({ error: 'Estado de publicación inválido' }); if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 100)) return res.status(400).json({ error: 'Título inválido' }); if (caption !== undefined && (typeof caption !== 'string' || caption.length > 1000)) return res.status(400).json({ error: 'Descripción inválida' }); if (visibility !== undefined && !['public','members_basic','members_medium','members_high','tokens'].includes(visibility)) return res.status(400).json({ error: 'Privacidad inválida' }); if (visibility === 'tokens' && !['photo','gallery'].includes(post.type)) return res.status(400).json({ error: 'Solo las fotos y galerías se pueden vender por tokens' }); if (price_tokens !== undefined && (!Number.isInteger(Number(price_tokens)) || Number(price_tokens) < 1 || Number(price_tokens) > 10000)) return res.status(400).json({ error: 'Precio inválido' }); if (status !== undefined) post.status = status; if (title !== undefined) post.title = title.trim(); if (caption !== undefined) post.caption = caption.trim(); if (visibility !== undefined) { post.visibility = visibility; post.price_tokens = visibility === 'tokens' ? Number(price_tokens ?? post.price_tokens) : 0; } else if (price_tokens !== undefined && post.visibility === 'tokens') post.price_tokens = Number(price_tokens); post.updated_at = new Date().toISOString(); await db.save(); res.json({ post, studio: creatorSnapshot(req.auth.id) }); });
app.post('/api/creator/live/start', auth, role('creator'), (_req, res) => res.status(410).json({ error: 'Las transmisiones en vivo no están disponibles por ahora.' }));
app.patch('/api/creator/live', auth, role('creator'), async (req, res) => { const live = [...db.creator_lives].reverse().find(item => Number(item.creator_id) === Number(req.auth.id) && item.status === 'live'); if (!live) return res.status(404).json({ error: 'No hay una transmisión activa' }); const { title, chat_mode, followers_only, slow_mode } = req.body || {}; if (title !== undefined) { if (typeof title !== 'string' || !title.trim() || title.length > 100) return res.status(400).json({ error: 'Título del directo inválido' }); live.title = title.trim(); } if (chat_mode !== undefined) { if (!['everyone','followers','members'].includes(chat_mode)) return res.status(400).json({ error: 'Modo de chat inválido' }); live.chat_mode = chat_mode; } if (followers_only !== undefined) { if (typeof followers_only !== 'boolean') return res.status(400).json({ error: 'El filtro de seguidores debe ser booleano' }); live.followers_only = followers_only; } if (slow_mode !== undefined) { const seconds = Number(slow_mode); if (![0,5,10,30,60].includes(seconds)) return res.status(400).json({ error: 'Modo lento inválido' }); live.slow_mode = seconds; } live.updated_at = new Date().toISOString(); await db.save(); res.json({ live, studio: creatorSnapshot(req.auth.id) }); });
app.post('/api/creator/live/stop', auth, role('creator'), async (req, res) => { const live = [...db.creator_lives].reverse().find(item => Number(item.creator_id) === Number(req.auth.id) && item.status === 'live'); if (!live) return res.status(404).json({ error: 'No hay una transmisión activa' }); live.status = 'ended'; live.ended_at = new Date().toISOString(); await db.save(); res.json({ live, studio: creatorSnapshot(req.auth.id) }); });
app.post('/api/creator/live/moderators', auth, role('creator'), async (req, res) => { const audience = db.creator_audience.find(item => Number(item.id) === Number(req.body?.audience_id) && Number(item.creator_id) === Number(req.auth.id)); if (!audience) return res.status(404).json({ error: 'La persona no pertenece a tu audiencia' }); const existing = db.creator_live_moderators.find(item => Number(item.audience_id) === Number(audience.id) && Number(item.creator_id) === Number(req.auth.id)); if (existing) return res.json({ moderator: existing, studio: creatorSnapshot(req.auth.id) }); const moderator = { id: db.nextId(db.creator_live_moderators), creator_id: req.auth.id, audience_id: audience.id, name: audience.name, assigned_at: new Date().toISOString() }; db.creator_live_moderators.push(moderator); await db.save(); res.status(201).json({ moderator, studio: creatorSnapshot(req.auth.id) }); });
app.delete('/api/creator/live/moderators/:id', auth, role('creator'), async (req, res) => { const index = db.creator_live_moderators.findIndex(item => Number(item.id) === Number(req.params.id) && Number(item.creator_id) === Number(req.auth.id)); if (index < 0) return res.status(404).json({ error: 'Moderador del directo no encontrado' }); db.creator_live_moderators.splice(index,1); await db.save(); res.json({ studio: creatorSnapshot(req.auth.id) }); });
app.get('/api/moderation/overview', auth, role('moderator', 'admin', 'superadmin'), permission('moderate_content'), async (_req, res) => { const reports = db.mode === 'postgres' ? await db.listModerationReports() : db.moderation_reports; const queue = db.mode === 'postgres' ? await db.listPendingProfiles() : db.profiles.filter(profile => !profile.approved); const actions = db.mode === 'postgres' ? await db.listModerationActions() : db.moderation_actions; res.json({ open_reports: reports.filter(report => ['open','reviewing'].includes(report.status)).length, pending_profiles: queue.length, resolved_today: actions.filter(action => Date.now() - new Date(action.created_at).getTime() < 86400000).length, critical: reports.filter(report => report.priority === 'critical' && !['resolved','dismissed'].includes(report.status)).length }); });
app.get('/api/moderation/queue', auth, role('moderator', 'admin', 'superadmin'), permission('approve_profiles'), async (_req, res) => { const profiles = db.mode === 'postgres' ? await db.listPendingProfiles() : db.profiles.filter(profile => !profile.approved); res.json({ profiles }); });
app.get('/api/moderation/reports', auth, role('moderator', 'admin', 'superadmin'), permission('resolve_reports'), async (_req, res) => { const reports = db.mode === 'postgres' ? await db.listModerationReports() : db.moderation_reports.map(report => ({ ...report, profile_name: db.profiles.find(profile => profile.id === report.profile_id)?.name || 'Contenido retirado', reporter_name: db.users.find(user => user.id === report.reporter_id)?.name || 'Sistema' })); res.json({ reports }); });
app.patch('/api/moderation/reports/:id', auth, role('moderator', 'admin', 'superadmin'), permission('resolve_reports'), async (req, res) => { const { status, note = '' } = req.body || {}; if (!['reviewing','resolved','dismissed'].includes(status) || typeof note !== 'string' || note.length > 500) return res.status(400).json({ error: 'Estado o nota de moderación inválidos' }); if (db.mode === 'postgres') { const report = await db.resolveModerationReport(req.params.id,status,req.auth.id,note.trim()); if (!report) return res.status(404).json({ error: 'Reporte no encontrado' }); return res.json({ report }); } const report = db.moderation_reports.find(item => Number(item.id) === Number(req.params.id)); if (!report) return res.status(404).json({ error: 'Reporte no encontrado' }); report.status=status; report.assigned_to=req.auth.id; report.resolved_at=['resolved','dismissed'].includes(status)?new Date().toISOString():null; db.moderation_actions.push({ id:db.nextId(db.moderation_actions),moderator_id:req.auth.id,target_type:'report',target_id:report.id,action:status,note:note.trim(),created_at:new Date().toISOString() }); db.save(); res.json({ report }); });
app.get('/api/moderation/actions', auth, role('moderator', 'admin', 'superadmin'), async (_req, res) => { const actions = db.mode === 'postgres' ? await db.listModerationActions() : [...db.moderation_actions].reverse().slice(0,100).map(action => ({...action,moderator_name:db.users.find(user => user.id === action.moderator_id)?.name || 'Sistema'})); res.json({ actions }); });
app.get('/api/wallet', auth, async (req, res) => { if (db.mode === 'postgres') { const wallet=await db.getTokenWallet(req.auth.id); return res.json({ ...wallet, catalog:TOKEN_PRODUCTS }); } let wallet=db.token_wallets.find(item=>Number(item.user_id)===Number(req.auth.id)); if(!wallet){wallet={user_id:req.auth.id,balance:0,updated_at:new Date().toISOString()};db.token_wallets.push(wallet);db.save();} const transactions=[...db.token_transactions].filter(item=>Number(item.user_id)===Number(req.auth.id)).reverse().slice(0,50); const unlocks=db.token_unlocks.filter(item=>Number(item.user_id)===Number(req.auth.id)).map(item=>item.product_id); res.json({ balance:wallet.balance,updated_at:wallet.updated_at,transactions,unlocks,catalog:TOKEN_PRODUCTS }); });
app.get('/api/payments/yape/packs', (_req,res) => res.json({ packs:YAPE_PACKS, enabled:YAPE_PACKS.length > 0 }));
app.get('/api/creator/publication-plan', auth, role('creator','admin','superadmin'), async (req,res) => {
  const subscription = db.mode === 'postgres' ? await db.getCreatorPublication(req.auth.id) : db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(req.auth.id));
  const payments = db.mode === 'postgres' ? await db.listManualPayments(req.auth.id) : db.payments.filter(item => item.provider === 'yape' && item.purpose === 'creator_publication' && Number(item.user_id) === Number(req.auth.id));
  res.json({ plans:config.BETA_FREE_ACCESS ? [] : PUBLICATION_PLANS,subscription,active:config.BETA_FREE_ACCESS || Boolean(subscription && new Date(subscription.expires_at).getTime() > Date.now()),beta_free:config.BETA_FREE_ACCESS,payments:payments.filter(item => item.purpose === 'creator_publication') });
});
app.post('/api/creator/publication-plan', auth, role('creator','admin','superadmin'), throttle(5, 60 * 60 * 1000), async (req,res) => {
  const plan = PUBLICATION_PLANS.find(item => item.id === req.body?.plan);
  const code = String(req.body?.operation_code || '').trim().toUpperCase();
  if (!plan) return res.status(400).json({ error:'Plan semanal inválido' });
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) return res.status(400).json({ error:'Ingresa un código de operación válido de Yape' });
  let payment;
  if (db.mode === 'postgres') {
    try { payment = await db.createManualPayment(req.auth.id,0,plan.soles,code,'creator_publication',plan.id); }
    catch (error) { if (error.code === '23505') return res.status(409).json({ error:'Este código de operación ya fue registrado' }); throw error; }
  } else {
    if (db.payments.some(item => item.provider === 'yape' && item.operation_code === code)) return res.status(409).json({ error:'Este código de operación ya fue registrado' });
    payment = { id:db.nextId(db.payments),user_id:req.auth.id,amount_tokens:0,amount_pen:plan.soles,provider:'yape',purpose:'creator_publication',publication_plan:plan.id,operation_code:code,status:'pending',created_at:new Date().toISOString() };
    db.payments.push(payment); await db.save();
  }
  res.status(201).json({ payment });
});
app.get('/api/payments/yape/mine', auth, async (req,res) => {
  const payments = db.mode === 'postgres' ? await db.listManualPayments(req.auth.id) : db.payments.filter(item => item.provider === 'yape' && Number(item.user_id) === Number(req.auth.id)).sort((a,b) => b.created_at.localeCompare(a.created_at));
  res.json({ payments });
});
app.post('/api/payments/yape', auth, throttle(5, 60 * 60 * 1000), async (req,res) => {
  const tokens = Number(req.body?.tokens);
  const code = String(req.body?.operation_code || '').trim().toUpperCase();
  const pack = YAPE_PACKS.find(item => item.tokens === tokens);
  if (!pack) return res.status(400).json({ error:'Paquete Yape sin precio configurado' });
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) return res.status(400).json({ error:'Ingresa el código de operación de Yape (6 a 40 caracteres)' });
  let payment;
  if (db.mode === 'postgres') {
    try { payment = await db.createManualPayment(req.auth.id,tokens,pack.soles,code); }
    catch (error) { if (error.code === '23505') return res.status(409).json({ error:'Este código de operación ya fue registrado' }); throw error; }
  } else {
    if (db.payments.some(item => item.provider === 'yape' && item.operation_code === code)) return res.status(409).json({ error:'Este código de operación ya fue registrado' });
    payment = { id:db.nextId(db.payments),user_id:req.auth.id,amount_tokens:tokens,amount_pen:pack.soles,provider:'yape',operation_code:code,status:'pending',created_at:new Date().toISOString() };
    db.payments.push(payment); await db.save();
  }
  res.status(201).json({ payment });
});
app.get('/api/moderation/payments', auth, role('moderator','admin','superadmin'), permission('review_payments'), async (_req,res) => {
  const payments = db.mode === 'postgres' ? await db.listManualPayments() : db.payments.filter(item => item.provider === 'yape').map(item => ({ ...item,user_name:db.users.find(user => Number(user.id) === Number(item.user_id))?.name,user_email:db.users.find(user => Number(user.id) === Number(item.user_id))?.email })).sort((a,b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.created_at.localeCompare(a.created_at));
  res.json({ payments });
});
app.patch('/api/moderation/payments/:id', auth, role('moderator','admin','superadmin'), permission('review_payments'), async (req,res) => {
  const decision = req.body?.decision;
  const note = String(req.body?.note || '').trim().slice(0,500);
  if (!['approved','rejected'].includes(decision)) return res.status(400).json({ error:'Decisión inválida' });
  if (decision === 'rejected' && !note) return res.status(400).json({ error:'Indica el motivo del rechazo' });
  let payment;
  if (db.mode === 'postgres') payment = await db.reviewManualPayment(req.params.id,req.auth.id,decision,note);
  else {
    payment = db.payments.find(item => String(item.id) === req.params.id && item.provider === 'yape' && item.status === 'pending');
    if (payment) {
      payment.status = decision; payment.reviewer_id = req.auth.id; payment.review_note = note; payment.reviewed_at = new Date().toISOString();
      if (decision === 'approved' && payment.purpose === 'creator_publication') { const prior = db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(payment.user_id)); const expiresAt = new Date(Math.max(Date.now(),new Date(prior?.expires_at || 0).getTime()) + 7 * 86400000).toISOString(); if (prior) Object.assign(prior,{ plan:payment.publication_plan,starts_at:payment.reviewed_at,expires_at:expiresAt,payment_id:payment.id }); else db.creator_publication_subscriptions.push({ user_id:payment.user_id,plan:payment.publication_plan,starts_at:payment.reviewed_at,expires_at:expiresAt,payment_id:payment.id }); }
      else if (decision === 'approved') { const wallet = jsonWallet(payment.user_id); wallet.balance += payment.amount_tokens; wallet.updated_at = payment.reviewed_at; db.token_transactions.push({ id:db.nextId(db.token_transactions),user_id:payment.user_id,amount:payment.amount_tokens,type:'manual_yape_credit',description:`Recarga Yape aprobada: ${payment.amount_tokens} tokens`,reference:String(payment.id),created_at:payment.reviewed_at }); }
      db.moderation_actions.push({ id:db.nextId(db.moderation_actions),moderator_id:req.auth.id,target_type:'manual_payment',target_id:payment.id,action:decision,note,created_at:payment.reviewed_at });
      await db.save();
    }
  }
  if (!payment) return res.status(409).json({ error:'Solicitud inexistente o ya revisada' });
  notify(payment.user_id, decision === 'approved' ? 'payment_approved' : 'payment_rejected', decision === 'approved' ? 'Pago aprobado' : 'Pago rechazado', decision === 'approved' ? (payment.purpose === 'creator_publication' ? 'Tu plan semanal de publicación ya está activo.' : `${payment.amount_tokens} tokens fueron acreditados a tu cuenta.`) : (note || 'Revisa los datos de tu solicitud.'));
  await db.save();
  res.json({ payment });
});
app.post('/api/payments/demo/:id/confirm', demoOnly, auth, async (req, res) => { const payment = db.payments.find(item => item.id === req.params.id && Number(item.user_id) === Number(req.auth.id)); if (!payment) return res.status(404).json({ error: 'Orden no encontrada' }); if (payment.status === 'paid') return res.json({ payment, already_processed: true, wallet: { balance: jsonWallet(req.auth.id).balance } }); payment.status = 'paid'; payment.paid_at = new Date().toISOString(); const wallet = jsonWallet(req.auth.id); wallet.balance += payment.amount_tokens; wallet.updated_at = payment.paid_at; db.token_transactions.push({ id: db.nextId(db.token_transactions), user_id: req.auth.id, amount: payment.amount_tokens, type: 'demo_payment', description: `Pago Kinexy Demo: ${payment.amount_tokens} tokens`, reference: payment.id, created_at: payment.paid_at }); await db.save(); res.status(201).json({ payment, wallet: { balance: wallet.balance, updated_at: wallet.updated_at } }); });
app.post('/api/wallet/demo-credit', demoOnly, auth, async (req, res) => { const amount=Number(req.body?.amount); const method=req.body?.method; if(!TOKEN_PACKS.has(amount)||!TOKEN_METHODS.has(method)) return res.status(400).json({error:'Paquete o método de prueba inválido'}); if(db.mode==='postgres'){const result=await db.creditDemoTokens(req.auth.id,amount,method);return res.status(201).json(result);} let wallet=db.token_wallets.find(item=>Number(item.user_id)===Number(req.auth.id));if(!wallet){wallet={user_id:req.auth.id,balance:0,updated_at:new Date().toISOString()};db.token_wallets.push(wallet);} wallet.balance+=amount;wallet.updated_at=new Date().toISOString();const transaction={id:db.nextId(db.token_transactions),user_id:req.auth.id,amount,type:'demo_credit',description:`Recarga de prueba: ${amount} tokens`,reference:method,created_at:new Date().toISOString()};db.token_transactions.push(transaction);db.save();res.status(201).json({wallet:{balance:wallet.balance,updated_at:wallet.updated_at},transaction}); });
app.post('/api/wallet/spend', auth, async (req, res) => { const product=TOKEN_PRODUCTS.find(item=>item.id===req.body?.product_id);if(!product)return res.status(400).json({error:'Producto de tokens inválido'});if(db.mode==='postgres'){const result=await db.spendTokens(req.auth.id,product);if(!result)return res.status(409).json({error:'Saldo de tokens insuficiente'});return res.json(result);}let wallet=db.token_wallets.find(item=>Number(item.user_id)===Number(req.auth.id));if(!wallet){wallet={user_id:req.auth.id,balance:0,updated_at:new Date().toISOString()};db.token_wallets.push(wallet);}const prior=db.token_unlocks.find(item=>Number(item.user_id)===Number(req.auth.id)&&item.product_id===product.id);if(prior)return res.json({wallet:{balance:wallet.balance,updated_at:wallet.updated_at},already_unlocked:true});if(wallet.balance<product.cost)return res.status(409).json({error:'Saldo de tokens insuficiente'});wallet.balance-=product.cost;wallet.updated_at=new Date().toISOString();db.token_unlocks.push({user_id:req.auth.id,product_id:product.id,created_at:new Date().toISOString()});const transaction={id:db.nextId(db.token_transactions),user_id:req.auth.id,amount:-product.cost,type:'content_unlock',description:`Desbloqueo: ${product.title}`,reference:product.id,created_at:new Date().toISOString()};db.token_transactions.push(transaction);db.save();res.json({wallet:{balance:wallet.balance,updated_at:wallet.updated_at},transaction,already_unlocked:false}); });
app.get('/api/wallet/history', auth, async (req, res) => { const transactions = db.mode === 'postgres' ? (await db.getTokenWallet(req.auth.id)).transactions : (db.token_transactions || []).filter(item => Number(item.user_id) === Number(req.auth.id)).reverse(); res.json({ transactions }); });
app.get('/api/wallet/withdrawals', auth, async (req,res) => { const withdrawals = db.mode === 'postgres' ? await db.listWithdrawals(req.auth.id) : db.withdrawal_requests.filter(item => Number(item.user_id) === Number(req.auth.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)); res.json({ withdrawals, withdrawal_value_pen: WITHDRAWAL_VALUE_PEN }); });
app.post('/api/wallet/withdrawals', auth, role('creator','admin','superadmin'), throttle(5, 60 * 60 * 1000), async (req,res) => { const amount=Number(req.body?.amount_tokens); const method=String(req.body?.method || 'yape'); const destination=String(req.body?.destination || '').trim(); if (!Number.isInteger(amount)||amount<1||amount>100000||!['yape','bank'].includes(method)||destination.length<6||destination.length>160) return res.status(400).json({error:'Completa un retiro válido: tokens, método y destino.'}); let result; if(db.mode==='postgres') result=await db.createWithdrawal(req.auth.id,amount,method,destination); else { const wallet=jsonWallet(req.auth.id); if(wallet.balance<amount) result=null; else { const created_at=new Date().toISOString(); wallet.balance-=amount; wallet.updated_at=created_at; const request={id:db.nextId(db.withdrawal_requests),user_id:req.auth.id,amount_tokens:amount,method,destination,status:'pending',review_note:'',created_at}; db.withdrawal_requests.push(request); db.token_transactions.push({id:db.nextId(db.token_transactions),user_id:req.auth.id,amount:-amount,type:'withdrawal_requested',description:`Retiro solicitado: ${amount} tokens`,reference:`withdrawal:${request.id}`,created_at}); await db.save(); result={request,wallet}; } } if(!result) return res.status(409).json({error:'No tienes saldo suficiente para este retiro.'}); await notifyStaff('withdrawal_requested','Nuevo retiro solicitado',`Se solicitó retirar ${amount} tokens (S/ ${(amount*WITHDRAWAL_VALUE_PEN).toFixed(2)}).`); await db.save(); res.status(201).json({...result, amount_pen:Number((amount*WITHDRAWAL_VALUE_PEN).toFixed(2))}); });
app.get('/api/moderation/withdrawals', auth, role('moderator','admin','superadmin'), permission('review_payments'), async (_req,res) => { const withdrawals=db.mode==='postgres' ? await db.listWithdrawals() : db.withdrawal_requests.map(item=>({...item,user_name:db.users.find(u=>Number(u.id)===Number(item.user_id))?.name || 'Usuario',user_email:db.users.find(u=>Number(u.id)===Number(item.user_id))?.email || ''})).sort((a,b)=>(a.status==='pending'?-1:1)-(b.status==='pending'?-1:1)||new Date(b.created_at)-new Date(a.created_at)); res.json({withdrawals,withdrawal_value_pen:WITHDRAWAL_VALUE_PEN}); });
app.patch('/api/moderation/withdrawals/:id', auth, role('moderator','admin','superadmin'), permission('review_payments'), async (req,res) => { const decision=req.body?.decision; const note=String(req.body?.note || '').trim().slice(0,500); if(!['approved','rejected'].includes(decision)) return res.status(400).json({error:'Decisión inválida'}); if(decision==='rejected'&&!note) return res.status(400).json({error:'Indica el motivo del rechazo'}); let withdrawal; if(db.mode==='postgres') withdrawal=await db.reviewWithdrawal(req.params.id,req.auth.id,decision,note); else { withdrawal=db.withdrawal_requests.find(item=>String(item.id)===req.params.id&&item.status==='pending'); if(withdrawal){withdrawal.status=decision;withdrawal.reviewer_id=req.auth.id;withdrawal.review_note=note;withdrawal.reviewed_at=new Date().toISOString();if(decision==='rejected'){const wallet=jsonWallet(withdrawal.user_id);wallet.balance+=Number(withdrawal.amount_tokens);wallet.updated_at=withdrawal.reviewed_at;db.token_transactions.push({id:db.nextId(db.token_transactions),user_id:withdrawal.user_id,amount:Number(withdrawal.amount_tokens),type:'withdrawal_refund',description:`Reembolso de retiro rechazado: ${withdrawal.amount_tokens} tokens`,reference:`withdrawal:${withdrawal.id}`,created_at:withdrawal.reviewed_at});}await db.save();}} if(!withdrawal) return res.status(409).json({error:'Solicitud inexistente o ya revisada'}); notify(withdrawal.user_id,decision==='approved'?'withdrawal_approved':'withdrawal_rejected',decision==='approved'?'Retiro aprobado':'Retiro rechazado',decision==='approved'?`Tu retiro de ${withdrawal.amount_tokens} tokens fue aprobado. El pago manual se procesará a tu destino registrado.`:(note||'Tus tokens fueron devueltos a tu billetera.')); await db.save(); res.json({withdrawal}); });

app.get('/api/messages', auth, async (req, res) => { const partnerId = req.query.partner_id ? Number(req.query.partner_id) : null; const messages = db.messages.filter(item => { const isUser = Number(item.sender_id) === Number(req.auth.id) || Number(item.receiver_id) === Number(req.auth.id); if (!isUser) return false; if (partnerId) return (Number(item.sender_id) === Number(req.auth.id) && Number(item.receiver_id) === partnerId) || (Number(item.receiver_id) === Number(req.auth.id) && Number(item.sender_id) === partnerId); return true; }); res.json({ messages }); });
app.get('/api/messages/access', auth, async (req, res) => { const partnerId = Number(req.query.partner_id); const partner = await getUser(partnerId); if (!partner || partnerId === Number(req.auth.id)) return res.status(404).json({ error: 'Conversación no encontrada' }); const needsContribution = partner.role === 'creator'; const unlocked = !needsContribution || db.message_unlocks.some(item => Number(item.sender_id) === Number(req.auth.id) && Number(item.receiver_id) === partnerId); res.json({ unlocked, requires_contribution: needsContribution, cost: needsContribution ? MESSAGE_UNLOCK_COST : 0 }); });
app.get('/api/messages/typing', auth, async (req, res) => { const partnerId = Number(req.query.partner_id); if (!Number.isInteger(partnerId) || partnerId < 1 || partnerId === Number(req.auth.id) || !(await getUser(partnerId))) return res.status(404).json({ error: 'Conversación no encontrada' }); const key = `${partnerId}:${req.auth.id}`; const expiresAt = Number(typingStatus.get(key) || 0); if (expiresAt <= Date.now()) typingStatus.delete(key); res.json({ typing: expiresAt > Date.now() }); });
app.post('/api/messages/typing', auth, async (req, res) => { const recipientId = Number(req.body?.receiver_id); const typing = req.body?.typing; if (!Number.isInteger(recipientId) || recipientId < 1 || recipientId === Number(req.auth.id) || typeof typing !== 'boolean' || !(await getUser(recipientId))) return res.status(400).json({ error: 'Estado de escritura inválido' }); const key = `${req.auth.id}:${recipientId}`; if (typing) typingStatus.set(key, Date.now() + 3000); else typingStatus.delete(key); publishRealtime('typing:update', { sender_id: Number(req.auth.id), receiver_id: recipientId, typing }, client => client.userId === recipientId || client.userId === Number(req.auth.id)); res.json({ typing }); });
app.post('/api/messages/unlock', auth, async (req, res) => { const recipientId = Number(req.body?.receiver_id); const recipient = await getUser(recipientId); if (!recipient || recipientId === Number(req.auth.id)) return res.status(404).json({ error: 'Creador no encontrado' }); if (recipient.role !== 'creator') return res.json({ unlocked: true, cost: 0 }); const existing = db.message_unlocks.find(item => Number(item.sender_id) === Number(req.auth.id) && Number(item.receiver_id) === recipientId); if (existing) { const balance = db.mode === 'postgres' ? (await db.getTokenWallet(req.auth.id)).balance : jsonWallet(req.auth.id).balance; return res.json({ unlocked: true, cost: MESSAGE_UNLOCK_COST, wallet: { balance } }); } const transfer = db.mode === 'postgres' ? await db.transferTokens(req.auth.id, recipientId, MESSAGE_UNLOCK_COST, 'message_contribution', `Aporte para escribir a ${recipient.name}`) : jsonTransferTokens(req.auth.id, recipientId, MESSAGE_UNLOCK_COST, 'message_contribution', `Aporte para escribir a ${recipient.name}`); if (!transfer) return res.status(409).json({ error: 'Saldo de tokens insuficiente para abrir este chat.' }); const unlock = { id: db.nextId(db.message_unlocks), sender_id: req.auth.id, receiver_id: recipientId, amount: MESSAGE_UNLOCK_COST, created_at: transfer.createdAt }; db.message_unlocks.push(unlock); notify(recipientId, 'message_contribution', 'Nuevo aporte para chat', `Recibiste ${MESSAGE_UNLOCK_COST} tokens.`); await db.save(); res.status(201).json({ unlocked: true, cost: MESSAGE_UNLOCK_COST, wallet: { balance: transfer.sender.balance, updated_at: transfer.sender.updated_at }, contribution: unlock }); });
app.post('/api/tips', auth, async (req, res) => { const recipientId = Number(req.body?.receiver_id); const amount = Number(req.body?.amount); const recipient = await getUser(recipientId); if (!recipient || recipientId === Number(req.auth.id) || !Number.isInteger(amount) || amount < 1 || amount > 10000) return res.status(400).json({ error: 'Selecciona un creador y un tip válido.' }); const transfer = db.mode === 'postgres' ? await db.transferTokens(req.auth.id, recipientId, amount, 'tip', `Tip para ${recipient.name}`) : jsonTransferTokens(req.auth.id, recipientId, amount, 'tip', `Tip para ${recipient.name}`); if (!transfer) return res.status(409).json({ error: 'Saldo de tokens insuficiente para enviar este tip.' }); const tip = { id: db.nextId(db.tips), sender_id: req.auth.id, receiver_id: recipientId, amount, created_at: transfer.createdAt }; db.tips.push(tip); notify(recipientId, 'tip', 'Nuevo tip', `Recibiste ${amount} tokens.`); await db.save(); res.status(201).json({ tip, wallet: { balance: transfer.sender.balance, updated_at: transfer.sender.updated_at } }); });
app.get('/api/creators/:profileId/follow', auth, async (req, res) => { const profile = db.profiles.find(item => Number(item.id) === Number(req.params.profileId)); if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' }); const following = db.creator_audience.some(item => Number(item.creator_id) === Number(profile.owner_id) && Number(item.user_id) === Number(req.auth.id)); res.json({ following }); });
app.post('/api/creators/:profileId/follow', auth, async (req, res) => { const profile = db.profiles.find(item => Number(item.id) === Number(req.params.profileId)); if (!profile || Number(profile.owner_id) === Number(req.auth.id)) return res.status(400).json({ error: 'Perfil no válido' }); const creatorId = Number(profile.owner_id); let audience = db.creator_audience.find(item => Number(item.creator_id) === creatorId && Number(item.user_id) === Number(req.auth.id)); if (!audience) { const user = await getUser(req.auth.id); audience = { id: db.nextId(db.creator_audience), creator_id: creatorId, user_id: req.auth.id, name: user.name, joined_at: new Date().toISOString() }; db.creator_audience.push(audience); notify(creatorId, 'follow', 'Nuevo seguidor', `${user.name} comenzó a seguirte.`); await db.save(); } res.json({ following: true, audience }); });
app.delete('/api/creators/:profileId/follow', auth, async (req, res) => { const profile = db.profiles.find(item => Number(item.id) === Number(req.params.profileId)); if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' }); const index = db.creator_audience.findIndex(item => Number(item.creator_id) === Number(profile.owner_id) && Number(item.user_id) === Number(req.auth.id)); if (index >= 0) db.creator_audience.splice(index, 1); await db.save(); res.json({ following: false }); });
app.post('/api/messages', auth, async (req, res) => { const { receiver_id, text } = req.body || {}; const recipientId = Number(receiver_id); if (!Number.isInteger(recipientId) || recipientId < 1 || recipientId === Number(req.auth.id) || typeof text !== 'string' || !text.trim() || text.length > 2000) return res.status(400).json({ error: 'Mensaje o destinatario inválidos' }); const recipient = await getUser(recipientId); if (!recipient) return res.status(404).json({ error: 'Destinatario no encontrado' }); const needsContribution = recipient.role === 'creator'; const unlocked = db.message_unlocks.some(item => Number(item.sender_id) === Number(req.auth.id) && Number(item.receiver_id) === recipientId); if (needsContribution && !unlocked) return res.status(402).json({ error: `Aporta ${MESSAGE_UNLOCK_COST} tokens para escribir a este creador.`, requires_unlock: true, cost: MESSAGE_UNLOCK_COST }); const message = { id: db.nextId(db.messages), sender_id: req.auth.id, receiver_id: recipientId, text: text.trim(), read: false, created_at: new Date().toISOString() }; db.messages.push(message); notify(recipientId, 'message', 'Nuevo mensaje', 'Tienes un mensaje nuevo en tu bandeja.'); await db.save(); res.status(201).json({ message }); });
app.get('/api/messages/conversations', auth, async (req, res) => { db.messages ||= []; const msgs = db.messages.filter(m => Number(m.sender_id) === Number(req.auth.id) || Number(m.receiver_id) === Number(req.auth.id)); const map = new Map(); msgs.forEach(m => { const partnerId = Number(m.sender_id) === Number(req.auth.id) ? Number(m.receiver_id) : Number(m.sender_id); const current = map.get(partnerId) || { latest: m, unread: 0 }; if (new Date(m.created_at) > new Date(current.latest.created_at)) current.latest = m; if (Number(m.sender_id) === partnerId && !m.read) current.unread++; map.set(partnerId, current); }); const conversations = Array.from(map.entries()).map(([partner_id, data]) => { const userObj = db.users?.find(u => Number(u.id) === Number(partner_id)); const profileObj = db.profiles?.find(p => Number(p.owner_id) === Number(partner_id)); const partner_name = userObj?.name || profileObj?.name || `Usuario #${partner_id}`; return { partner_id, partner_name, last_message: data.latest.text, latest_at: data.latest.created_at, unread_count: data.unread, latest: data.latest }; }); res.json({ conversations }); });
app.patch('/api/messages/:id/read', auth, async (req, res) => { db.messages ||= []; const message = db.messages.find(m => String(m.id) === req.params.id && Number(m.receiver_id) === Number(req.auth.id)); if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' }); message.read = true; if (db.save) await db.save(); res.json({ message }); });
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: db?.mode || 'starting', timestamp: new Date().toISOString() }));
app.get('/api/ready', async (_req, res) => {
  if (db.mode === 'postgres') await db.pool.query('SELECT 1');
  let uploadsWritable = false;
  try { fs.accessSync(config.UPLOAD_DIR, fs.constants.R_OK | fs.constants.W_OK); uploadsWritable = true; } catch {}
  res.json({ status: 'ready', database: db.mode, google_oauth: Boolean(config.GOOGLE_CLIENT_ID), uploads_writable: uploadsWritable, timestamp: new Date().toISOString() });
});
app.get('/api/notifications', auth, async (req, res) => { const items = db.notifications.filter(item => Number(item.user_id) === Number(req.auth.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,50); res.json({ notifications: items, unread: items.filter(item => !item.read).length }); });
app.patch('/api/notifications/read', auth, async (req, res) => { db.notifications.filter(item => Number(item.user_id) === Number(req.auth.id) && !item.read).forEach(item => { item.read = true; }); await db.save(); res.json({ marked: true }); });
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((error, _req, res, _next) => {
  const bad = error.type === 'entity.parse.failed';
  const large = error.type === 'entity.too.large';
  const uploadTooLarge = error.code === 'LIMIT_FILE_SIZE';
  const uploadInvalid = error.code === 'LIMIT_UNEXPECTED_FILE';
  const uploadPermission = ['EACCES', 'EPERM', 'EROFS', 'ENOENT'].includes(error.code);
  const duplicate = error.code === '23505';
  res.status(bad ? 400 : large || uploadTooLarge ? 413 : uploadInvalid ? 400 : duplicate ? 409 : uploadPermission ? 503 : 500).json({ error: bad ? 'JSON inválido' : large ? 'Solicitud demasiado grande' : uploadTooLarge ? 'El archivo supera el límite de 8 MB.' : uploadInvalid ? 'Solo se permiten imágenes JPG, PNG o WEBP y videos MP4, WEBM o MOV.' : duplicate ? 'El registro ya existe' : uploadPermission ? 'El almacenamiento de imágenes no está disponible. Contacta al administrador.' : 'No se pudo completar la operación' });
});
return app;
}
if (require.main === module) {
  if (config.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /^(kinexy[_-]?dev|replace|reemplazar)/i.test(process.env.JWT_SECRET))) { console.error('JWT_SECRET seguro de al menos 32 caracteres es obligatorio en producción'); process.exit(1); }
  initDatabase().then(db => createApp(db).listen(config.PORT, () => console.log(`Kinexy Backend en http://localhost:${config.PORT} [DB: ${db.mode}]`))).catch(error => { console.error(error); process.exit(1); });
}
module.exports = { createApp };
