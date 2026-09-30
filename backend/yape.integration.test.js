const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('Yape requiere revisión global y acredita una sola vez', async () => {
  const db = { mode:'json', users:[], profiles:[], membership_plans:[], moderation_reports:[], moderation_actions:[], token_wallets:[], token_transactions:[], token_unlocks:[], payments:[], messages:[], creator_posts:[], nextId(items) { return Math.max(0,...items.map(item => Number(item.id) || 0)) + 1; }, save() {} };
  const server = createApp(db).listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url,method='GET',body,token) => { const response = await fetch(base+url,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body&&JSON.stringify(body)}); return { status:response.status, data:await response.json() }; };
  try {
    const client = await request('/api/auth/register','POST',{name:'Cliente',email:'yape-client@test.local',password:'SecurePass1!',date_of_birth:'1990-01-01',accepted_terms:true,accepted_privacy:true});
    const modAccount = await request('/api/auth/register','POST',{name:'Moderador',email:'yape-mod@test.local',password:'SecurePass1!',date_of_birth:'1990-01-01',accepted_terms:true,accepted_privacy:true});
    db.users.find(item => item.id === modAccount.data.user.id).role = 'moderator';
    const mod = await request('/api/auth/login','POST',{email:'yape-mod@test.local',password:'SecurePass1!',date_of_birth:'1990-01-01',accepted_terms:true,accepted_privacy:true});
    const c = client.data.token;
    assert.equal((await request('/api/payments/yape/packs')).data.packs[0].soles,20);
    const payment = await request('/api/payments/yape','POST',{tokens:40,operation_code:'ABC12345'},c);
    assert.equal(payment.status,201);
    assert.equal((await request('/api/wallet','GET',undefined,c)).data.balance,0);
    assert.equal((await request('/api/moderation/payments','GET',undefined,c)).status,403);
    assert.equal((await request('/api/moderation/payments','GET',undefined,mod.data.token)).data.payments.length,1);
    assert.equal((await request('/api/payments/yape','POST',{tokens:40,operation_code:'ABC12345'},c)).status,409);
    assert.equal((await request(`/api/moderation/payments/${payment.data.payment.id}`,'PATCH',{decision:'approved'},mod.data.token)).status,200);
    assert.equal((await request('/api/wallet','GET',undefined,c)).data.balance,40);
    assert.equal((await request(`/api/moderation/payments/${payment.data.payment.id}`,'PATCH',{decision:'approved'},mod.data.token)).status,409);
    assert.equal((await request('/api/wallet','GET',undefined,c)).data.balance,40);
    assert.equal(db.token_transactions.filter(item => item.type === 'manual_yape_credit').length,1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
