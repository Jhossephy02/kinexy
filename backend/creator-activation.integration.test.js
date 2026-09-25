const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('una cuenta existente se activa con 100 tokens sin registro duplicado ni pago simulado', async () => {
  const previousMode = process.env.CREATOR_ACTIVATION_FREE;
  process.env.CREATOR_ACTIVATION_FREE = 'false';
  const db = {
    mode: 'json', users: [{ id: 1, name: 'Admin', email: 'activation-admin', password: 'pass', role: 'superadmin' }],
    profiles: [], membership_plans: [], moderation_reports: [], moderation_actions: [],
    token_wallets: [], token_transactions: [], token_unlocks: [], messages: [], creator_posts: [],
    creator_sales: [], creator_audience: [], creator_lives: [], creator_live_moderators: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; }, save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, method = 'GET', body, token) => {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const account = await request('/api/auth/register', 'POST', { name: 'Cliente', email: 'activation-client@test.local', password: 'SecurePass1!', date_of_birth: '1990-01-01', accepted_terms: true, accepted_privacy: true, role: 'creator' });
    assert.equal(account.status, 201);
    assert.equal(account.data.user.role, 'client');
    const token = account.data.token;
    assert.equal((await request('/api/user/become-creator', 'POST', { method: 'direct' }, token)).status, 400);
    assert.equal((await request('/api/user/become-creator', 'POST', { method: 'tokens' }, token)).status, 409);
    const admin = await request('/api/auth/login', 'POST', { email: 'activation-admin', password: 'pass' });
    assert.equal((await request('/api/admin/wallet/credit', 'POST', { user_ids: [account.data.user.id], amount: 150, note: 'Prueba' }, admin.data.token)).status, 201);
    const promoted = await request('/api/user/become-creator', 'POST', { method: 'tokens' }, token);
    assert.equal(promoted.status, 200);
    assert.equal(promoted.data.user.role, 'creator');
    assert.equal((await request('/api/wallet', 'GET', undefined, promoted.data.token)).data.balance, 50);
    assert.equal((await request('/api/user/become-creator', 'POST', { method: 'tokens' }, promoted.data.token)).status, 200);
    assert.equal((await request('/api/wallet', 'GET', undefined, promoted.data.token)).data.balance, 50);
    assert.equal(db.users.length, 2);
    process.env.CREATOR_ACTIVATION_FREE = 'true';
    const freeCreator = await request('/api/auth/register', 'POST', { name: 'Nueva creadora', email: 'free-creator@test.local', password: 'SecurePass1!', date_of_birth: '1990-01-01', accepted_terms: true, accepted_privacy: true, role: 'creator' });
    assert.equal(freeCreator.status, 201);
    assert.equal(freeCreator.data.user.role, 'creator');
    const existingClient = await request('/api/auth/register', 'POST', { name: 'Cliente existente', email: 'free-client@test.local', password: 'SecurePass1!', date_of_birth: '1990-01-01', accepted_terms: true, accepted_privacy: true });
    const freeActivation = await request('/api/user/become-creator', 'POST', { method: 'free' }, existingClient.data.token);
    assert.equal(freeActivation.status, 200);
    assert.equal(freeActivation.data.user.role, 'creator');
    assert.equal(freeActivation.data.free_activation, true);
    assert.equal((await request('/api/wallet', 'GET', undefined, freeActivation.data.token)).data.balance, 0);
  } finally {
    if (previousMode === undefined) delete process.env.CREATOR_ACTIVATION_FREE;
    else process.env.CREATOR_ACTIVATION_FREE = previousMode;
    await new Promise(resolve => server.close(resolve));
  }
});
