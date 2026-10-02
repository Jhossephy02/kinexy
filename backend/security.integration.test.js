const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('seguridad: cada cuenta queda aislada y los tips solo llegan a creadores', async () => {
  const db = { mode: 'json', users: [
    { id: 1, name: 'Creadora A', email: 'creator-a', password: 'pass', role: 'creator' },
    { id: 2, name: 'Creadora B', email: 'creator-b', password: 'pass', role: 'creator' },
    { id: 3, name: 'Cliente A', email: 'client-a', password: 'pass', role: 'client' },
    { id: 4, name: 'Cliente B', email: 'client-b', password: 'pass', role: 'client' }
  ], profiles: [], membership_plans: [], moderation_reports: [], moderation_actions: [], token_wallets: [{ user_id: 3, balance: 30 }], token_transactions: [], token_unlocks: [], messages: [], creator_posts: [], creator_sales: [], creator_audience: [], creator_lives: [], creator_live_moderators: [], nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; }, save() {} };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, token, method = 'GET', body) => { const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) }); return { status: response.status, headers: response.headers, data: await response.json().catch(() => ({})) }; };
  const login = async email => (await request('/api/auth/login', null, 'POST', { email, password: 'pass' })).data.token;
  try {
    const [creatorA, creatorB, clientA, clientB] = await Promise.all(['creator-a','creator-b','client-a','client-b'].map(login));
    const post = await request('/api/creator/posts', creatorA, 'POST', { title: 'Propiedad A', type: 'text', visibility: 'public', status: 'published' });
    assert.equal(post.status, 201); const postId = post.data.post.id;
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal((await request('/api/creator/studio')).status, 401);
    assert.equal((await request(`/api/creator/posts/${postId}`, clientA, 'PATCH', { title: 'Ataque' })).status, 403);
    assert.equal((await request(`/api/creator/posts/${postId}`, creatorB, 'PATCH', { title: 'Ataque' })).status, 404);
    assert.equal((await request(`/api/creator/posts/${postId}`, creatorB, 'DELETE')).status, 404);
    const comment = await request(`/api/creator/posts/${postId}/comments`, clientA, 'POST', { text: 'Comentario legítimo de cliente.' });
    assert.equal(comment.status, 201);
    assert.equal((await request(`/api/comments/${comment.data.comment.id}`, clientB, 'DELETE')).status, 403);
    assert.equal((await request('/api/tips', clientA, 'POST', { receiver_id: 4, amount: 5 })).status, 400);
    assert.equal((await request('/api/tips', clientA, 'POST', { receiver_id: 1, amount: 5 })).status, 201);
    assert.equal((await request('/api/admin/wallet/credit', clientA, 'POST', { user_ids: [3], amount: 100 })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
