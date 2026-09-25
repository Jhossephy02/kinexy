const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createApp } = require('./server');
test('API protects credentials, unpublished records and ownership', async () => {
  const hash = bcrypt.hashSync('correct-password', 4);
  const db = { mode:'json', users:[{id:1,name:'Creator',email:'creator',password:hash,role:'creator'}, {id:2,name:'Root',email:'admin',password:'admin',role:'superadmin'}, {id:3,name:'Moderator',email:'mod',password:hash,role:'moderator'}, {id:4,name:'Propietario',email:'mjhossephy@gmail.com',password:hash,role:'client'}], profiles:[{id:1,owner_id:2,approved:false,active:true,name:'Hidden'}, {id:2,owner_id:1,approved:true,active:false,name:'Inactive'}], membership_plans:[], moderation_reports:[{id:1,profile_id:1,reason:'Review',details:'Test',priority:'high',status:'open',created_at:new Date().toISOString()}], moderation_actions:[], token_wallets:[], token_transactions:[], token_unlocks:[], messages:[], creator_posts:[], creator_sales:[], creator_audience:[{id:1,creator_id:1,name:'TrustedViewer',messages:20,trusted:true}], creator_lives:[], creator_live_moderators:[], nextId:items=>Math.max(0,...items.map(x=>x.id))+1, save(){} };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, method='GET', body, token) { const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}); return {status:response.status,body:await response.json()}; }
  try {
    assert.equal((await request('/api/auth/login','POST',{email:'creator',password:hash})).status,401);
    assert.equal((await request('/api/auth/login','POST',{email:[],password:{}})).status,400);
    const login=await request('/api/auth/login','POST',{email:'creator',password:'correct-password'}); assert.equal(login.status,200); assert.equal(login.body.user.password,undefined); const token=login.body.token;
    assert.equal((await request('/api/users','GET',undefined,token)).status,403);
    assert.equal((await request('/api/profiles/1')).status,404);
    assert.equal((await request('/api/profiles/2')).status,404);
    assert.deepEqual((await request('/api/profiles')).body.profiles,[]);
    assert.equal((await request('/api/profiles/2','PUT',{approved:true},token)).status,400);
    assert.equal((await request('/api/profiles/1','PUT',{name:'Changed'},token)).status,404);
    assert.equal((await request('/api/advertiser/profiles','GET',undefined,token)).status,200);
    assert.equal((await request('/api/profiles','POST',{name:'Test',city:'Test',age:17},token)).status,400);
    const created=await request('/api/profiles','POST',{name:'Test',city:'Test',age:25,area:'Centro',photo:'/uploads/demo.jpg'},token); assert.equal(created.status,201); assert.equal(created.body.profile.owner_id,1); assert.equal(created.body.profile.approved,false);
    const plan=await request('/api/membership-plans','POST',{name:'Plus',price:35,currency:'PEN',description:'Plan de prueba',benefits:['Contenido']},token); assert.equal(plan.status,201); assert.equal(plan.body.plan.creator_id,1);
    assert.equal((await request('/api/membership-plans')).body.plans.length,1);
    assert.equal((await request('/api/membership-plans','POST',{name:'Bad',price:-1,benefits:[]},token)).status,400);
    assert.equal((await request('/api/wallet','GET',undefined,token)).body.balance,0);
    assert.equal((await request('/api/wallet/demo-credit','POST',{amount:81,method:'yape'},token)).status,400);
    const credit=await request('/api/wallet/demo-credit','POST',{amount:80,method:'yape'},token); assert.equal(credit.status,201); assert.equal(credit.body.wallet.balance,80);
    const spend=await request('/api/wallet/spend','POST',{product_id:'exclusive_post'},token); assert.equal(spend.status,200); assert.equal(spend.body.wallet.balance,55);
    const repeat=await request('/api/wallet/spend','POST',{product_id:'exclusive_post'},token); assert.equal(repeat.body.already_unlocked,true); assert.equal(repeat.body.wallet.balance,55);
    assert.equal((await request('/api/wallet/spend','POST',{product_id:'live_access'},token)).status,409);
    assert.equal((await request('/api/creator/studio','GET',undefined,token)).status,200);
    assert.equal((await request('/api/creator/posts','POST',{title:'Foto sin archivo',type:'photo',visibility:'tokens',price_tokens:30,status:'published'},token)).status,400);
    const post=await request('/api/creator/posts','POST',{title:'Nota exclusiva',type:'text',visibility:'tokens',price_tokens:30,status:'published'},token); assert.equal(post.status,201); assert.equal(post.body.studio.stats.published,1);
    assert.equal((await request('/api/creator/posts','POST',{title:'Sin precio',type:'photo',visibility:'tokens',price_tokens:0},token)).status,400);
    assert.equal((await request('/api/creator/live/start','POST',{title:'Directo de prueba'},token)).status,410);
    
    // Testing Messaging & Become Creator & Wallet History
    const clientUser = await request('/api/auth/register', 'POST', { name: 'ClientUser', email: 'client_test@kinexy.pe', password: 'SecurePass1!', date_of_birth: '1990-01-01', accepted_terms: true, accepted_privacy: true, role: 'client' });
    assert.equal(clientUser.status, 201);
    const clientToken = clientUser.body.token;

    // Test messaging validation & send
    assert.equal((await request('/api/messages', 'POST', { receiver_id: 1, text: '' }, clientToken)).status, 400);
    assert.equal((await request('/api/messages', 'POST', { receiver_id: 999, text: 'Hola' }, clientToken)).status, 404);
    assert.equal((await request('/api/messages', 'POST', { receiver_id: clientUser.body.user.id, text: 'Hola' }, clientToken)).status, 400);
    assert.equal((await request('/api/messages', 'POST', { receiver_id: 1, text: 'Hola Creador!' }, clientToken)).status, 402);
    await request('/api/wallet/demo-credit', 'POST', { amount: 40, method: 'yape' }, clientToken);
    const contribution = await request('/api/messages/unlock', 'POST', { receiver_id: 1 }, clientToken);
    assert.equal(contribution.status, 201);
    const sentMsg = await request('/api/messages', 'POST', { receiver_id: 1, text: 'Hola Creador!' }, clientToken);
    assert.equal(sentMsg.status, 201);
    assert.equal(sentMsg.body.message.text, 'Hola Creador!');

    // Test conversations list & filtered messages query
    const convs = await request('/api/messages/conversations', 'GET', undefined, clientToken);
    assert.equal(convs.status, 200);
    assert.equal(convs.body.conversations.length, 1);
    assert.equal(convs.body.conversations[0].last_message, 'Hola Creador!');

    const filteredMsgs = await request('/api/messages?partner_id=1', 'GET', undefined, clientToken);
    assert.equal(filteredMsgs.status, 200);
    assert.equal(filteredMsgs.body.messages.length, 1);

    // Test mark as read
    const readRes = await request(`/api/messages/${sentMsg.body.message.id}/read`, 'PATCH', {}, token);
    assert.equal(readRes.status, 200);

    // Un pago directo sin procesador verificado no puede activar el rol.
    const creatorDirect = await request('/api/user/become-creator', 'POST', { method: 'direct', provider: 'Yape' }, clientToken);
    assert.equal(creatorDirect.status, 400);

    // Test wallet history
    const historyRes = await request('/api/wallet/history', 'GET', undefined, token);
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.body.transactions));

    const modLogin=await request('/api/auth/login','POST',{email:'mod',password:'correct-password'}); assert.equal(modLogin.status,200); assert.equal((await request('/api/users','GET',undefined,modLogin.body.token)).status,403); assert.equal((await request('/api/moderation/overview','GET',undefined,modLogin.body.token)).status,200);
    const rootLogin=await request('/api/auth/login','POST',{email:'admin',password:'admin'}); const rootToken=rootLogin.body.token;
    const ownerLogin=await request('/api/auth/login','POST',{email:'MJHOSSEPHY@GMAIL.COM',password:'correct-password'}); assert.equal(ownerLogin.status,200); assert.equal(ownerLogin.body.user.role,'superadmin');
    const ownerDirectory=(await request('/api/users','GET',undefined,ownerLogin.body.token)).body.users.find(item=>item.email==='mjhossephy@gmail.com'); assert.equal(ownerDirectory.protected_owner,true); assert.equal(ownerDirectory.password,undefined);
    assert.equal((await request('/api/auth/register','POST',{name:'Falso propietario',email:'mjhossephy@gmail.com',password:'SecurePass1!',date_of_birth:'1990-01-01',accepted_terms:true,accepted_privacy:true})).status,403);
    assert.equal((await request('/api/users/4/role','PATCH',{role:'client'},rootToken)).status,409);
    assert.equal((await fetch(base+'/api/users/4',{method:'DELETE',headers:{Authorization:'Bearer '+rootToken}})).status,409);
    const overview=await request('/api/moderation/overview','GET',undefined,rootToken); assert.equal(overview.body.open_reports,1); assert.equal(overview.body.pending_profiles,2);
    const review=await request('/api/moderation/reports/1','PATCH',{status:'reviewing',note:'Assigned'},rootToken); assert.equal(review.body.report.status,'reviewing'); assert.equal(db.moderation_actions.length,1);
    const managed=await request('/api/users','POST',{name:'Moderator',email:'moderator',password:'password1',role:'moderator'},rootToken); assert.equal(managed.status,201); assert.equal(managed.body.user.password,undefined);
    assert.equal((await request(`/api/users/${managed.body.user.id}/role`,'PATCH',{role:'admin'},rootToken)).body.user.role,'admin');
    assert.equal((await request('/api/users/2/role','PATCH',{role:'client'},rootToken)).status,409);
    const ownDelete=await fetch(base+'/api/users/2',{method:'DELETE',headers:{Authorization:'Bearer '+rootToken}}); assert.equal(ownDelete.status,409);
    const remove=await fetch(base+`/api/users/${managed.body.user.id}`,{method:'DELETE',headers:{Authorization:'Bearer '+rootToken}}); assert.equal(remove.status,204);
    const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}); assert.equal(malformed.status,400); assert.equal((await malformed.json()).error,'JSON inválido');
    const app2=createApp({mode:'postgres',findUser:async()=>{throw new Error('secret database detail');}}).listen(0,'127.0.0.1'); await new Promise(resolve=>app2.once('listening',resolve));
    try {const response=await fetch('http://127.0.0.1:'+app2.address().port+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'x',password:'x'})});assert.equal(response.status,500);assert.equal(JSON.stringify(await response.json()).includes('secret'),false);} finally {await new Promise(resolve=>app2.close(resolve));}
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
