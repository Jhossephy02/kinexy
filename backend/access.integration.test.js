const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./server');
const config = require('./src/config');

test('precio por foto, video y niveles de membresía restringen archivo y saldo', async () => {
  const previousBeta = config.BETA_FREE_ACCESS; config.BETA_FREE_ACCESS = false;
  const db = {
    mode: 'json', users: [
      { id: 1, name: 'Admin', email: 'admin-access', password: 'pass', role: 'superadmin' },
      { id: 2, name: 'Creadora', email: 'creator-access', password: 'pass', role: 'creator' },
      { id: 3, name: 'Cliente', email: 'viewer-access', password: 'pass', role: 'client' }
    ], profiles: [], membership_plans: [], moderation_reports: [], moderation_actions: [],
    creator_publication_subscriptions: [{ user_id:2,plan:'basico',expires_at:new Date(Date.now()+86400000).toISOString() }],
    token_wallets: [{ user_id: 3, balance: 100 }], token_transactions: [], token_unlocks: [],
    messages: [], creator_posts: [], creator_sales: [], creator_audience: [], creator_lives: [], creator_live_moderators: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; }, save() {}
  };
  const filename = `qa-access-${process.pid}-${Date.now()}.png`;
  const file = path.join(config.UPLOAD_DIR, filename);
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(file, Buffer.from('contenido de prueba'));
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, token, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.arrayBuffer() };
  };
  try {
    const creator = (await request('/api/auth/login', null, 'POST', { email: 'creator-access', password: 'pass' })).data.token;
    const client = (await request('/api/auth/login', null, 'POST', { email: 'viewer-access', password: 'pass' })).data.token;
    const url = `/uploads/${filename}`;
    const priced = await request('/api/creator/posts', creator, 'POST', { title: 'Foto privada', caption: 'Descripción pública', visibility: 'tokens', price_tokens: 15, media_url: url, status: 'published' });
    assert.equal(priced.status, 201);
    const id = priced.data.post.id;
    assert.equal((await request(url)).status, 403);
    const listing = await request('/api/creator/posts/2', client);
    assert.equal(listing.data.posts[0].locked, true);
    assert.equal(listing.data.posts[0].media_url, '');
    assert.equal((await request(`/api/creator/posts/${id}/media`)).status, 401);
    assert.equal((await request(`/api/creator/posts/${id}/media`, client)).status, 403);
    assert.equal((await request(`/api/creator/posts/${id}/unlock`, client, 'POST', {})).status, 201);
    assert.equal((await request(`/api/creator/posts/${id}/unlock`, client, 'POST', {})).data.already_unlocked, true);
    assert.equal((await request('/api/wallet', client)).data.balance, 85);
    assert.equal((await request(`/api/creator/posts/${id}/media`, client)).status, 200);
    const changedPrice = await request(`/api/creator/posts/${id}`, creator, 'PATCH', { price_tokens: 30 });
    assert.equal(changedPrice.status, 200);
    assert.equal(changedPrice.data.post.price_tokens, 30);
    assert.equal((await request(`/api/creator/posts/${id}/media`, client)).status, 200);
    assert.equal((await request('/api/wallet', client)).data.balance, 85);
    const video = await request('/api/creator/posts', creator, 'POST', { title: 'Video privado', type: 'video', visibility: 'tokens', price_tokens: 10, media_url: url, status: 'published' });
    assert.equal(video.status, 201);
    assert.equal((await request(`/api/creator/posts/${video.data.post.id}/unlock`, client, 'POST', {})).status, 201);
    assert.equal((await request(`/api/creator/posts/${video.data.post.id}/media`, client)).status, 200);
    assert.equal((await request('/api/wallet', client)).data.balance, 75);
    const deleted = await request(`/api/creator/posts/${video.data.post.id}`, creator, 'DELETE');
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.studio.posts.some(post => post.id === video.data.post.id), false);
    assert.equal((await request(`/api/creator/posts/${video.data.post.id}/media`, client)).status, 404);
    assert.equal(fs.existsSync(file), true);
    const memberPost = await request('/api/creator/posts', creator, 'POST', { title: 'Plus', visibility: 'members_medium', media_url: url, status: 'published' });
    assert.equal(memberPost.status, 201);
    assert.equal((await request('/api/membership/subscribe', client, 'POST', { tier: 1 })).status, 201);
    assert.equal((await request('/api/creator/posts/2', client)).data.posts.find(post => post.id === memberPost.data.post.id).locked, true);
    assert.equal((await request('/api/membership/subscribe', client, 'POST', { tier: 2 })).status, 201);
    assert.equal((await request('/api/creator/posts/2', client)).data.posts.find(post => post.id === memberPost.data.post.id).locked, false);
    assert.equal((await request(`/api/creator/posts/${memberPost.data.post.id}/media`, client)).status, 200);
    assert.equal((await request('/api/wallet', client)).data.balance, 15);
  } finally {
    config.BETA_FREE_ACCESS = previousBeta;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(file, { force: true });
  }
});
