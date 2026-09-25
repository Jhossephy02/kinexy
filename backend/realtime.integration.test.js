const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('mensajes de escritura y cambios llegan por el canal en tiempo real', async () => {
  const db = {
    mode: 'json',
    users: [
      { id: 1, name: 'Creadora RT', email: 'creator-rt', password: 'pass', role: 'creator' },
      { id: 2, name: 'Cliente RT', email: 'client-rt', password: 'pass', role: 'client' }
    ],
    profiles: [], token_wallets: [], token_transactions: [], moderation_reports: [], moderation_actions: [], membership_plans: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; }, save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async email => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass' }) })).json()).token;
  const controller = new AbortController();
  try {
    const [creatorToken, clientToken] = await Promise.all([login('creator-rt'), login('client-rt')]);
    const stream = await fetch(`${base}/api/events`, { headers: { Authorization: `Bearer ${creatorToken}` }, signal: controller.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    await reader.read();
    const eventPromise = (async () => {
      const decoder = new TextDecoder(); let text = '';
      while (!text.includes('event: typing:update')) { const chunk = await reader.read(); if (chunk.done) break; text += decoder.decode(chunk.value); }
      return text;
    })();
    const typing = await fetch(`${base}/api/messages/typing`, { method: 'POST', headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ receiver_id: 1, typing: true }) });
    assert.equal(typing.status, 200);
    const received = await Promise.race([eventPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('No llegó el evento en tiempo real')), 1500))]);
    assert.match(received, /"sender_id":2/);
    assert.match(received, /"typing":true/);
  } finally {
    controller.abort();
    await new Promise(resolve => server.close(resolve));
  }
});
