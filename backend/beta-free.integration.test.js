const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('./src/config');
const { createApp } = require('./server');

test('beta gratuita publica perfiles y contenido; solo el chat exige tokens', async () => {
  const previous = config.BETA_FREE_ACCESS;
  config.BETA_FREE_ACCESS = true;
  const db = {
    mode: 'json',
    users: [
      { id: 1, name: 'Creadora Beta', email: 'creator-beta', password: 'pass', role: 'creator' },
      { id: 2, name: 'Cliente Beta', email: 'client-beta', password: 'pass', role: 'client' }
    ],
    profiles: [{ id: 9, owner_id: 1, name: 'Perfil Beta', age: 25, city: 'Pucallpa', area: 'Centro', category: 'Premium', approved: true, active: true, contact_whatsapp: '51987654321', contact_price_tokens: 20 }],
    creator_posts: [{ id: 8, creator_id: 1, title: 'Foto beta', caption: '', type: 'photo', visibility: 'tokens', price_tokens: 35, media_url: '/uploads/beta.jpg', status: 'published', created_at: new Date().toISOString() }],
    creator_publication_subscriptions: [],
    token_wallets: [{ user_id: 2, balance: 0 }],
    token_transactions: [], moderation_reports: [], moderation_actions: [], membership_plans: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; },
    save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, token, method = 'GET', body) {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  try {
    const client = (await request('/api/auth/login', null, 'POST', { email: 'client-beta', password: 'pass' })).data.token;
    const profiles = await request('/api/profiles');
    assert.equal(profiles.status, 200);
    assert.equal(profiles.data.beta_free, true);
    assert.equal(profiles.data.profiles[0].id, 9);
    const posts = await request('/api/creator/posts/1');
    assert.equal(posts.status, 200);
    assert.equal(posts.data.posts[0].locked, false);
    const contact = await request('/api/profiles/9/contact', client);
    assert.equal(contact.data.unlocked, true);
    assert.equal(contact.data.price_tokens, 0);
    const membership = await request('/api/membership/subscribe', client, 'POST', { tier: 1 });
    assert.equal(membership.status, 201);
    assert.equal(membership.data.beta_free, true);
    assert.equal(membership.data.wallet.balance, 0);
    const message = await request('/api/messages', client, 'POST', { receiver_id: 1, text: 'Hola' });
    assert.equal(message.status, 402);
    assert.equal(message.data.cost, 10);
  } finally {
    config.BETA_FREE_ACCESS = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
