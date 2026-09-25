const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { connectPostgres } = require('./postgres');
const config = require('../config');

const seedProfiles = [
  { id: 1, name: 'Valentina', age: 24, city: 'Pucallpa', area: 'Yarinacocha', category: 'Premium', rating: '4.9', tier: 'Platino', plan: 'premium', active: true, approved: true, price: 'S/ 180', photo: '/demo-profiles/valentina.jpg', schedule: 'Lun a Sab, 2:00 pm - 11:00 pm', description: 'Perfil verificado con disponibilidad actualizada.' },
  { id: 2, name: 'Isabella', age: 27, city: 'Pucallpa', area: 'Manantay', category: 'Maduras', rating: '4.6', tier: 'Platino', plan: 'destacado', active: true, approved: true, price: 'S/ 170', photo: '/demo-profiles/isabella.jpg', schedule: 'Con reserva', description: 'Publicación destacada con horarios publicados.' },
  { id: 3, name: 'Bianca', age: 28, city: 'Pucallpa', area: 'Callería', category: 'A Domicilio', rating: '4.7', tier: 'Platino', plan: 'destacado', active: true, approved: true, price: 'S/ 180', photo: '/demo-profiles/bianca.jpg', schedule: 'Previa coordinación', description: 'Ficha completa con estado activo.' },
  { id: 4, name: 'Mateo', age: 27, city: 'Pucallpa', area: 'Avenida principal', category: 'Premium', rating: '4.9', tier: 'Platino', plan: 'premium', active: true, approved: true, price: 'S/ 210', photo: '/demo-profiles/mateo.jpg', schedule: 'Previa cita', description: 'Creador de muestra con perfil de alta visibilidad.' },
  { id: 5, name: 'Diego', age: 30, city: 'Pucallpa', area: 'Yarinacocha', category: 'Económicas', rating: '4.6', tier: 'Platino', plan: 'destacado', active: true, approved: true, price: 'S/ 160', photo: '/demo-profiles/diego.jpg', schedule: 'Noches', description: 'Anuncio destacado con renovación próxima.' },
  { id: 6, name: 'André', age: 33, city: 'Pucallpa', area: 'Callería', category: 'Premium', rating: '4.8', tier: 'Platino', plan: 'premium', active: true, approved: true, price: 'S/ 190', photo: '/demo-profiles/andre.jpg', schedule: 'Previa reserva', description: 'Ficha premium para Pucallpa.' },
];

function initJson() {
  const file = config.DB_PATH.replace(/\.db$/, '.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  data.users ||= [{ id: 1, name: 'Superadministrador', email: 'admin', password: 'admin', role: 'superadmin', created_at: new Date().toISOString() }, { id: 2, name: 'Cliente demo', email: 'usuario@demo.com', password: 'usuario', role: 'client', created_at: new Date().toISOString() }, { id: 3, name: 'Creador demo', email: 'perfil@demo.com', password: 'perfil', role: 'creator', created_at: new Date().toISOString() }];
  if (data.role_schema_version !== 2) {
    const firstAdmin = data.users.find(user => user.role === 'admin');
    data.users.forEach(user => { if (user.role === 'advertiser') user.role = 'creator'; if (user.role === 'user') user.role = 'client'; });
    if (firstAdmin) firstAdmin.role = 'superadmin';
    data.role_schema_version = 2;
  }
  data.users.forEach((user, index) => { user.name ||= index === 0 ? 'Superadministrador' : user.email; });
  let jhossephy = data.users.find(user => user.email === 'jhossephy');
  if (!jhossephy) {
    jhossephy = { id: data.users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1, name: 'Jhossephy', email: 'jhossephy', password: 'jhossephy', role: 'creator', created_at: new Date().toISOString() };
    data.users.push(jhossephy);
  } else {
    jhossephy.name = 'Jhossephy';
    jhossephy.role = 'creator';
  }
  data.profiles ||= seedProfiles;
  // Los perfiles de muestra necesitan un creador para probar solicitud, chat y tokens de extremo a extremo.
  data.profiles.forEach(profile => { if (Number(profile.id) <= 6 && !profile.owner_id) profile.owner_id = 3; });
  const save = () => fs.writeFileSync(file, JSON.stringify(data, null, 2)); save();
  data.membership_plans ||= [
    { id: 1, creator_id: null, name: 'Esencial', price: 19, currency: 'PEN', description: 'Publicaciones exclusivas y novedades de tus creadores favoritos.', benefits: ['Contenido exclusivo', 'Novedades del creador'], active: true },
    { id: 2, creator_id: null, name: 'Plus', price: 39, currency: 'PEN', description: 'Acceso anticipado, encuestas y una experiencia más cercana.', benefits: ['Todo en Esencial', 'Acceso anticipado', 'Encuestas para miembros'], active: true },
    { id: 3, creator_id: null, name: 'Premium', price: 69, currency: 'PEN', description: 'La experiencia completa de comunidad con encuentros grupales programados.', benefits: ['Todo en Plus', 'Eventos grupales', 'Insignia Premium'], active: true }
  ];
  data.moderation_reports ||= [
    { id: 1, profile_id: 2, reporter_id: null, reason: 'Información por verificar', details: 'Revisar la información pública del perfil.', priority: 'medium', status: 'open', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 2, profile_id: 5, reporter_id: null, reason: 'Revisión preventiva', details: 'Control periódico de cumplimiento.', priority: 'low', status: 'open', created_at: new Date(Date.now() - 86400000).toISOString() }
  ];
  data.moderation_actions ||= [];
  data.token_wallets ||= data.users.map(user => ({ user_id: user.id, balance: 0, updated_at: new Date().toISOString() }));
  let jhossephyWallet = data.token_wallets.find(wallet => Number(wallet.user_id) === Number(jhossephy.id));
  if (!jhossephyWallet) { jhossephyWallet = { user_id: jhossephy.id, balance: 0, updated_at: new Date().toISOString() }; data.token_wallets.push(jhossephyWallet); }
  data.token_transactions ||= [];
  if (!data.token_transactions.some(transaction => transaction.reference === 'seed:jhossephy')) {
    jhossephyWallet.balance += 1000;
    jhossephyWallet.updated_at = new Date().toISOString();
    data.token_transactions.push({ id: data.token_transactions.reduce((max, transaction) => Math.max(max, Number(transaction.id) || 0), 0) + 1, user_id: jhossephy.id, amount: 1000, type: 'demo_credit', description: 'Saldo inicial para pruebas de creador', reference: 'seed:jhossephy', created_at: new Date().toISOString() });
  }
  data.token_unlocks ||= [];
  data.messages ||= [];
  data.message_unlocks ||= [];
  data.tips ||= [];
  if (!data.messages.some(message => Number(message.sender_id) === 3 && Number(message.receiver_id) === Number(jhossephy.id))) {
    data.messages.push({ id: data.messages.reduce((max, message) => Math.max(max, Number(message.id) || 0), 0) + 1, sender_id: 3, receiver_id: jhossephy.id, text: 'Hola Jhossephy, esta conversación está lista para tus pruebas.', read: false, created_at: new Date().toISOString() });
  }
  data.creator_posts ||= [
    { id: 1, creator_id: 3, title: 'Detrás de cámaras', caption: 'Una mirada exclusiva a mi nueva sesión.', type: 'photo', visibility: 'tokens', price_tokens: 25, status: 'published', media_url: '/demo-profiles/valentina.jpg', views: 1840, likes: 326, purchases: 74, revenue_tokens: 1850, created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: 2, creator_id: 3, title: 'Noche de preguntas', caption: 'Déjame tu pregunta para el próximo directo.', type: 'text', visibility: 'members', price_tokens: 0, status: 'published', media_url: '', views: 1120, likes: 241, purchases: 0, revenue_tokens: 0, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 3, creator_id: 3, title: 'Colección privada', caption: 'Contenido preparado para mis seguidores más cercanos.', type: 'gallery', visibility: 'tokens', price_tokens: 40, status: 'draft', media_url: '/demo-profiles/isabella.jpg', views: 0, likes: 0, purchases: 0, revenue_tokens: 0, created_at: new Date().toISOString() }
  ];
  // Move legacy sample posts into the same private storage used by newly uploaded paid media.
  for (const post of data.creator_posts) {
    const match = post.visibility !== 'public' && /^\/demo-profiles\/([\w.-]+\.(?:jpg|jpeg|png|webp))$/i.exec(post.media_url || '');
    if (!match) continue;
    const source = path.resolve(__dirname, '../../../frontend/public/demo-profiles', match[1]);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
    const filename = `legacy-private-post-${post.id}${path.extname(match[1]).toLowerCase()}`;
    const destination = path.join(config.UPLOAD_DIR, filename);
    if (!fs.existsSync(destination)) fs.copyFileSync(source, destination);
    post.media_url = `/uploads/${filename}`;
  }
  data.creator_sales ||= [
    { id: 1, creator_id: 3, post_id: 1, buyer: 'm•••@correo.com', amount_tokens: 25, created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 2, creator_id: 3, post_id: 1, buyer: 'l•••@correo.com', amount_tokens: 25, created_at: new Date(Date.now() - 18000000).toISOString() },
    { id: 3, creator_id: 3, post_id: 1, buyer: 'a•••@correo.com', amount_tokens: 25, created_at: new Date(Date.now() - 93600000).toISOString() }
  ];
  data.creator_audience ||= [
    { id: 1, creator_id: 3, name: 'LunaVioleta', joined_at: new Date(Date.now() - 2592000000).toISOString(), messages: 486, trusted: true },
    { id: 2, creator_id: 3, name: 'MarcoLive', joined_at: new Date(Date.now() - 1814400000).toISOString(), messages: 312, trusted: true },
    { id: 3, creator_id: 3, name: 'SofiNorte', joined_at: new Date(Date.now() - 1209600000).toISOString(), messages: 204, trusted: false },
    { id: 4, creator_id: 3, name: 'Andino99', joined_at: new Date(Date.now() - 777600000).toISOString(), messages: 158, trusted: true }
  ];
  data.creator_lives ||= [];
  data.post_unlocks ||= [];
  data.contact_unlocks ||= [];
  data.membership_subscriptions ||= [];
  data.creator_publication_subscriptions ||= [];
  data.creator_live_moderators ||= [{ id: 1, creator_id: 3, audience_id: 1, name: 'LunaVioleta', assigned_at: new Date(Date.now() - 604800000).toISOString() }];
  save();
  data.comments ||= [];
  data.profile_reviews ||= [];
  data.post_likes ||= [];
  data.payments ||= [];
  return { mode: 'json', users: data.users, profiles: data.profiles, membership_plans: data.membership_plans, membership_subscriptions: data.membership_subscriptions, creator_publication_subscriptions: data.creator_publication_subscriptions, token_wallets: data.token_wallets, token_transactions: data.token_transactions, token_unlocks: data.token_unlocks, post_unlocks: data.post_unlocks, contact_unlocks: data.contact_unlocks, messages: data.messages, message_unlocks: data.message_unlocks, tips: data.tips, comments: data.comments, profile_reviews: data.profile_reviews, post_likes: data.post_likes, payments: data.payments, creator_posts: data.creator_posts, creator_sales: data.creator_sales, creator_audience: data.creator_audience, creator_lives: data.creator_lives, creator_live_moderators: data.creator_live_moderators, moderation_reports: data.moderation_reports, moderation_actions: data.moderation_actions, save, nextId: (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1 };
}

async function initPostgres() {
  const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  await pool.query('SELECT 1');
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS profiles (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL, city TEXT NOT NULL, area TEXT, category TEXT, rating NUMERIC(2,1), tier TEXT, plan TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, approved BOOLEAN NOT NULL DEFAULT FALSE, price TEXT, photo TEXT, schedule TEXT, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  const users = (await pool.query('SELECT * FROM users ORDER BY id')).rows;
  const profiles = (await pool.query('SELECT * FROM profiles ORDER BY id')).rows;
  const db = { mode: 'postgres', pool, users, profiles, nextId: (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1 };
  db.save = async () => { for (const user of db.users) await pool.query('INSERT INTO users (id,name,email,password,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2,email=$3,password=$4,role=$5', [user.id,user.name,user.email,user.password,user.role,user.created_at]); for (const p of db.profiles) await pool.query('INSERT INTO profiles (id,name,age,city,area,category,rating,tier,plan,active,approved,price,photo,schedule,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET name=$2,age=$3,city=$4,area=$5,category=$6,rating=$7,tier=$8,plan=$9,active=$10,approved=$11,price=$12,photo=$13,schedule=$14,description=$15', [p.id,p.name,p.age,p.city,p.area,p.category,p.rating,p.tier,p.plan,p.active,p.approved,p.price,p.photo,p.schedule,p.description]); };
  if (!users.length) {
    const seedUsers = [{ name: 'Administrador', email: 'admin', password: 'admin', role: 'admin' }, { name: 'Usuario demo', email: 'usuario@demo.com', password: 'usuario', role: 'user' }, { name: 'Perfil demo', email: 'perfil@demo.com', password: 'perfil', role: 'advertiser' }];
    for (const user of seedUsers) await pool.query('INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4)', [user.name, user.email, await bcrypt.hash(user.password, 10), user.role]);
    db.users = (await pool.query('SELECT * FROM users ORDER BY id')).rows;
  }
  if (!profiles.length) { db.profiles = seedProfiles; await db.save(); }
  return db;
}

async function initDatabase() {
  if (config.NODE_ENV === 'production' && !config.DATABASE_URL) throw new Error('DATABASE_URL es obligatorio en producción');
  if (config.DATABASE_URL) { try { return await connectPostgres(config.DATABASE_URL); } catch (error) { if (config.NODE_ENV === 'production') throw error; console.warn(`PostgreSQL no disponible, se usa JSON local: ${error.message}`); } }
  return initJson();
}
module.exports = { initDatabase, seedProfiles };
