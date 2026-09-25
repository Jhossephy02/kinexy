const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createApp } = require('./server');

test('opiniones y reportes del perfil persisten y respetan identidad', async () => {
  const password = bcrypt.hashSync('password123', 4);
  const db = {
    mode: 'json', users: [
      { id: 1, name: 'Creadora', email: 'creator@test', password, role: 'creator' },
      { id: 2, name: 'Cliente', email: 'client@test', password, role: 'client' }
    ],
    profiles: [{ id: 7, owner_id: 1, name: 'Perfil beta', age: 25, city: 'Pucallpa', approved: true, active: true }],
    creator_publication_subscriptions: [{ user_id:1,plan:'basico',expires_at:new Date(Date.now()+86400000).toISOString() }],
    moderation_reports: [], moderation_actions: [], profile_reviews: [], notifications: [],
    nextId: items => Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1,
    save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    const client = await request('/api/auth/login', 'POST', { email: 'client@test', password: 'password123' });
    const creator = await request('/api/auth/login', 'POST', { email: 'creator@test', password: 'password123' });
    assert.equal((await request('/api/profiles/7/reviews')).body.summary.count, 0);
    assert.equal((await request('/api/profiles/7/reviews', 'POST', { rating: 5, text: 'Muy buena atención y comunicación.' })).status, 401);
    assert.equal((await request('/api/profiles/7/reviews', 'POST', { rating: 5, text: 'Muy buena atención y comunicación.' }, creator.body.token)).status, 409);
    assert.equal((await request('/api/profiles/7/reviews', 'POST', { rating: 5, text: 'Muy buena atención y comunicación.' }, client.body.token)).status, 201);
    const listed = await request('/api/profiles/7/reviews');
    assert.equal(listed.body.summary.average, 5);
    assert.equal(listed.body.reviews[0].author_name, 'Cliente');
    assert.equal((await request('/api/profiles/7/reviews', 'POST', { rating: 4, text: 'Actualizo mi experiencia con el perfil.' }, client.body.token)).status, 200);
    assert.equal(db.profile_reviews.length, 1);
    assert.equal((await request('/api/profiles/7/reports', 'POST', { reason: 'Información incorrecta', details: 'La zona publicada necesita revisión.' }, client.body.token)).status, 201);
    assert.equal(db.moderation_reports.length, 1);
    assert.equal((await request('/api/profiles/7/reports', 'POST', { reason: 'Información incorrecta' }, client.body.token)).status, 409);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
