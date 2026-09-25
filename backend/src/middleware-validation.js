const editable = new Set(['name', 'age', 'city', 'area', 'category', 'plan', 'price', 'photo', 'photos', 'schedule', 'description', 'identity', 'services', 'contact_whatsapp', 'contact_telegram', 'contact_price_tokens', 'show_price']);
function profileInput(req, res, next) {
  const body = req.body;
  if (!body || Array.isArray(body) || typeof body !== 'object') return res.status(400).json({ error: 'Datos de perfil inválidos' });
  const unsupported = Object.keys(body).filter(key => !editable.has(key));
  if (unsupported.length) return res.status(400).json({ error: `El perfil contiene campos no editables: ${unsupported.join(', ')}` });
  if (req.method === 'POST' && ['name', 'age', 'city', 'area', 'photo'].some(key => body[key] === undefined || body[key] === '')) return res.status(400).json({ error: 'Nombre, edad, ciudad, zona y foto son obligatorios' });
  for (const [key, value] of Object.entries(body)) {
    if (key === 'age') { const normalized = Number(value); if (!Number.isInteger(normalized) || normalized < 18 || normalized > 120) return res.status(400).json({ error: 'La edad debe ser un número entero entre 18 y 120' }); body[key] = normalized; }
    else if (key === 'show_price') { if (typeof value !== 'boolean') return res.status(400).json({ error: 'Visibilidad del precio inválida' }); }
    else if (key === 'contact_price_tokens') { const normalized = Number(value); if (!Number.isInteger(normalized) || normalized < 1 || normalized > 10000) return res.status(400).json({ error: 'El precio de contacto debe estar entre 1 y 10000 tokens' }); body[key] = normalized; }
    else if (key === 'photos') { if (!Array.isArray(value) || value.length > 12 || value.some(url => typeof url !== 'string' || !/^\/uploads\/[\w.-]+$/.test(url))) return res.status(400).json({ error: 'Las fotos del perfil no son válidas' }); }
    else if (key === 'contact_whatsapp') { const normalized = typeof value === 'string' ? value.replace(/[\s+()-]/g, '') : ''; if (normalized && !/^\d{8,15}$/.test(normalized)) return res.status(400).json({ error: 'Escribe un WhatsApp válido con código de país' }); body[key] = normalized; }
    else if (key === 'contact_telegram') { const normalized = typeof value === 'string' ? value.trim().replace(/^@/, '') : ''; if (normalized && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalized)) return res.status(400).json({ error: 'Escribe un usuario de Telegram válido' }); body[key] = normalized; }
    else { if (typeof value !== 'string' || value.length > (key === 'description' ? 3000 : 250)) return res.status(400).json({ error: 'Texto de perfil inválido o demasiado largo' }); body[key] = value.trim(); }
  }
  if (['name', 'city'].some(key => body[key] !== undefined && !body[key])) return res.status(400).json({ error: 'Nombre y ciudad no pueden estar vacíos' });
  next();
}
function credentials(req, res, next) {
  const body = req.body || {};
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email.trim() || !body.password || body.email.length > 254 || Buffer.byteLength(body.password) > 72) return res.status(400).json({ error: 'Introduce un usuario y una contraseña válidos' });
  body.email = body.email.trim().toLowerCase();
  if (req.path.endsWith('/register')) {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email);
    const passwordStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/.test(body.password);
    const born = typeof body.date_of_birth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth) ? new Date(`${body.date_of_birth}T00:00:00Z`) : null;
    const today = new Date();
    let age = born && !Number.isNaN(born.getTime()) ? today.getUTCFullYear() - born.getUTCFullYear() : -1;
    if (born && (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate()))) age -= 1;
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || !emailValid) return res.status(400).json({ error: 'Introduce un nombre y un correo electrónico válidos.' });
    if (!passwordStrong) return res.status(400).json({ error: 'La contraseña debe tener entre 10 y 72 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
    if (!born || age < 18 || age > 120) return res.status(403).json({ error: 'Solo pueden registrarse personas de 18 años o más.' });
    if (body.accepted_terms !== true || body.accepted_privacy !== true) return res.status(400).json({ error: 'Debes aceptar los términos y la política de privacidad.' });
  }
  next();
}
module.exports = { profileInput, credentials };
