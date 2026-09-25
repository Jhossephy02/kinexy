const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('contacto externo requiere tokens y no expone datos antes de pagar', async () => {
  const db = {
    mode: 'json',
    users: [
      { id: 1, name: 'Creadora', email: 'creator-contact', password: 'pass', role: 'creator' },
      { id: 2, name: 'Visitante', email: 'viewer-contact', password: 'pass', role: 'client' },
      { id: 3, name: 'Sin saldo', email: 'empty-contact', password: 'pass', role: 'client' }
    ],
    profiles: [{ id: 7, owner_id: 1, name: 'Creadora', age: 24, city: 'Pucallpa', area: 'Centro', category: 'Premium', photo: '/demo-profiles/valentina.jpg', approved: true, active: true, contact_whatsapp: '51987654321', contact_telegram: 'creadora_test', contact_price_tokens: 12 }],
    creator_publication_subscriptions: [{ user_id:1,plan:'basico',expires_at:new Date(Date.now()+86400000).toISOString() }],
    token_wallets: [{ user_id: 2, balance: 30 }, { user_id: 3, balance: 5 }], token_transactions: [],
    contact_unlocks: [], membership_plans: [], moderation_reports: [], moderation_actions: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; }, save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, token, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const creator = (await request('/api/auth/login', null, 'POST', { email: 'creator-contact', password: 'pass' })).data.token;
    const viewer = (await request('/api/auth/login', null, 'POST', { email: 'viewer-contact', password: 'pass' })).data.token;
    const empty = (await request('/api/auth/login', null, 'POST', { email: 'empty-contact', password: 'pass' })).data.token;
    assert.equal((await request('/api/profiles/7', creator, 'PUT', { contact_price_tokens: 0 })).status, 400);
    assert.equal((await request('/api/profiles/7', creator, 'PUT', { contact_whatsapp: '+51 987 654 321', contact_telegram: '@creadora_test', contact_price_tokens: 12 })).status, 200);
    const publicProfile = await request('/api/profiles/7');
    const publicList = await request('/api/profiles');
    assert.equal(publicProfile.status, 200);
    assert.equal(publicProfile.data.profile.contact_whatsapp, undefined);
    assert.equal(publicProfile.data.profile.contact_telegram, undefined);
    assert.equal(JSON.stringify(publicList.data).includes('51987654321'), false);
    assert.equal(publicProfile.data.profile.contact_price_tokens, 12);
    assert.equal((await request('/api/profiles/7/contact')).status, 401);
    const before = await request('/api/profiles/7/contact', viewer);
    assert.equal(before.data.unlocked, false);
    assert.deepEqual(before.data.links, {});
    assert.equal((await request('/api/profiles/7/contact/unlock', empty, 'POST', {})).status, 409);
    assert.equal(db.token_wallets.find(item => item.user_id === 3).balance, 5);
    const purchase = await request('/api/profiles/7/contact/unlock', viewer, 'POST', {});
    assert.equal(purchase.status, 201);
    assert.equal(purchase.data.links.whatsapp, 'https://wa.me/51987654321');
    assert.equal(purchase.data.links.telegram, 'https://t.me/creadora_test');
    assert.equal(db.token_wallets.find(item => item.user_id === 2).balance, 18);
    assert.equal(db.token_wallets.find(item => item.user_id === 1).balance, 12);
    assert.equal((await request('/api/profiles/7/contact/unlock', viewer, 'POST', {})).status, 200);
    assert.equal(db.token_wallets.find(item => item.user_id === 2).balance, 18);
    assert.equal((await request('/api/profiles/7/contact', viewer)).data.unlocked, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
