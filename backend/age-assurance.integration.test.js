const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

test('el registro exige mayoría de edad, consentimientos y contraseña segura', async () => {
  const db = { mode:'json', users:[], profiles:[], membership_plans:[], moderation_reports:[], moderation_actions:[], token_wallets:[], token_transactions:[], token_unlocks:[], nextId(items){return Math.max(0,...items.map(item=>Number(item.id)||0))+1;}, save(){} };
  const server = createApp(db).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const register = async body => { const response=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return {status:response.status,body:await response.json()}; };
  const common={name:'Cuenta segura',email:'secure@test.local',password:'SecurePass1!',accepted_terms:true,accepted_privacy:true};
  try {
    assert.equal((await register({...common,date_of_birth:'2012-01-01'})).status,403);
    assert.equal((await register({...common,email:'weak@test.local',date_of_birth:'1990-01-01',password:'password123'})).status,400);
    assert.equal((await register({...common,email:'no-consent@test.local',date_of_birth:'1990-01-01',accepted_privacy:false})).status,400);
    const adult=await register({...common,date_of_birth:'1990-01-01'});
    assert.equal(adult.status,201);
    assert.equal(db.users[0].date_of_birth,'1990-01-01');
    assert.ok(db.users[0].adult_confirmed_at);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
