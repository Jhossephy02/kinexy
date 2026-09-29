const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./server');
const config = require('./src/config');

test('integración completa: cuentas, perfiles, publicaciones, billetera, aportes, tips y chat', async () => {
  const db = {
    mode: 'json',
    users: [
      { id: 1, name: 'Root', email: 'root-test', password: 'root-test', role: 'superadmin' },
      { id: 2, name: 'Creador base', email: 'creator-base', password: 'creator-base', role: 'creator' }
    ],
    profiles: [], membership_plans: [], moderation_reports: [], moderation_actions: [],
    token_wallets: [], token_transactions: [], token_unlocks: [], messages: [],
    creator_posts: [], creator_sales: [], creator_audience: [], creator_lives: [], creator_live_moderators: [],
    nextId(items) { return Math.max(0, ...items.map(item => Number(item.id) || 0)) + 1; },
    save() {}
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const uploadedFiles = [];

  async function request(endpoint, { method = 'GET', body, token, form } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${endpoint}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }
  async function login(email, password) {
    const response = await request('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(response.status, 200, `no se pudo iniciar sesión: ${email}`);
    return response.body.token;
  }

  try {
    const rootToken = await login('root-test', 'root-test');

    const creatorAccount = await request('/api/users', { method: 'POST', token: rootToken, body: { name: 'Creadora QA', email: 'creator-qa', password: 'creator-pass', role: 'creator' } });
    const clientAccount = await request('/api/users', { method: 'POST', token: rootToken, body: { name: 'Cliente QA', email: 'client-qa', password: 'client-pass', role: 'client' } });
    const moderatorAccount = await request('/api/users', { method: 'POST', token: rootToken, body: { name: 'Moderación QA', email: 'moderator-qa', password: 'moderator-pass', role: 'moderator' } });
    assert.equal(creatorAccount.status, 201);
    assert.equal(clientAccount.status, 201);
    const creatorId = creatorAccount.body.user.id;
    const clientId = clientAccount.body.user.id;

    const creatorToken = await login('creator-qa', 'creator-pass');
    const clientToken = await login('client-qa', 'client-pass');
    const moderatorToken = await login('moderator-qa', 'moderator-pass');

    const grant = await request('/api/admin/wallet/credit', { method: 'POST', token: rootToken, body: { user_ids: [clientId], amount: 180, note: 'Prueba integral' } });
    assert.equal(grant.status, 201);
    assert.equal((await request('/api/wallet', { token: clientToken })).body.balance, 180);

    const form = new FormData();
    form.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8WQAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'qa.png');
    const upload = await request('/api/uploads/image', { method: 'POST', token: creatorToken, form });
    assert.equal(upload.status, 201);
    assert.match(upload.body.filename, /^[a-f0-9]{32}\.png$/);
    uploadedFiles.push(path.join(config.UPLOAD_DIR, upload.body.filename));
    const fakeForm = new FormData();
    fakeForm.append('image', new Blob([Buffer.from('no es una imagen')], { type: 'image/png' }), 'ataque.php');
    assert.equal((await request('/api/uploads/image', { method: 'POST', token: creatorToken, form: fakeForm })).status, 415, 'un archivo disfrazado debe rechazarse');
    assert.equal((await request('/uploads/archivo-inexistente-qa.png')).status, 404, 'un archivo ausente debe responder 404');

    const missingPhoto = await request('/api/profiles', { method: 'POST', token: creatorToken, body: { name: 'Sin foto', age: 25, city: 'Pucallpa', area: 'Centro' } });
    assert.equal(missingPhoto.status, 400);
    const profile = await request('/api/profiles', { method: 'POST', token: creatorToken, body: { name: 'Creadora QA', age: 25, city: 'Pucallpa', area: 'Centro', category: 'Premium', price: 'S/ 80', schedule: 'Noche', description: 'Perfil creado durante la prueba.', photo: upload.body.url } });
    assert.equal(profile.status, 201);
    assert.equal(profile.body.profile.approved, false);
    assert.equal((await request('/api/notifications', { token: moderatorToken })).body.notifications.some(item => item.type === 'profile_pending'), true, 'moderación debe recibir el aviso del nuevo perfil');
    assert.equal((await request('/api/profiles')).body.profiles.length, 0, 'un perfil pendiente no debe ser público');

    const approval = await request(`/api/profiles/${profile.body.profile.id}/approve`, { method: 'PATCH', token: rootToken, body: { approved: true } });
    assert.equal(approval.status, 200);
    assert.equal((await request('/api/notifications', { token: creatorToken })).body.notifications.some(item => item.type === 'profile_approved'), true, 'el creador debe recibir el resultado de moderación');

    const disableApproval = await request('/api/admin/role-permissions/moderator', { method: 'PATCH', token: rootToken, body: { permission: 'approve_profiles', enabled: false } });
    assert.equal(disableApproval.status, 200);
    assert.equal((await request(`/api/profiles/${profile.body.profile.id}/approve`, { method: 'PATCH', token: moderatorToken, body: { approved: false } })).status, 403, 'el permiso revocado debe aplicarse en el servidor');
    assert.equal((await request('/api/permissions/me', { token: moderatorToken })).body.permissions.includes('approve_profiles'), false);
    const editedProfile = await request(`/api/profiles/${profile.body.profile.id}`, { method: 'PUT', token: creatorToken, body: { description: 'Ficha actualizada por la creadora.' } });
    assert.equal(editedProfile.status, 200);
    assert.equal(editedProfile.body.profile.description, 'Ficha actualizada por la creadora.');
    const publicProfiles = await request('/api/profiles');
    assert.equal(publicProfiles.body.profiles.some(item => item.id === profile.body.profile.id), true, 'un perfil aprobado debe seguir visible sin depender de una membresía');
    const planPayment = await request('/api/creator/publication-plan', { method:'POST',token:creatorToken,body:{plan:'pro',operation_code:'QA-WEEK-123'} });
    assert.equal(planPayment.status,201);
    assert.equal((await request('/api/profiles')).body.profiles.some(item => item.id === profile.body.profile.id),true,'el pago pendiente no debe ocultar un perfil ya aprobado');
    assert.equal((await request(`/api/moderation/payments/${planPayment.body.payment.id}`, { method:'PATCH',token:rootToken,body:{decision:'approved'} })).status,200);
    assert.equal((await request('/api/profiles')).body.profiles.some(item => item.id === profile.body.profile.id),true);

    const post = await request('/api/creator/posts', { method: 'POST', token: creatorToken, body: { title: 'Post QA', caption: 'Contenido de prueba', type: 'photo', visibility: 'tokens', price_tokens: 25, media_url: upload.body.url, status: 'published' } });
    assert.equal(post.status, 201);
    assert.equal(post.body.post.media_url, upload.body.url);
    assert.equal(post.body.studio.stats.published, 1);
    const visiblePosts = await request(`/api/creator/posts/${creatorId}`, { token: clientToken });
    assert.equal(visiblePosts.status, 200);
    assert.equal(visiblePosts.body.posts[0].id, post.body.post.id);
    assert.equal(visiblePosts.body.posts[0].locked, true);

    const blockedMessage = await request('/api/messages', { method: 'POST', token: clientToken, body: { receiver_id: creatorId, text: 'Hola, quiero escribir.' } });
    assert.equal(blockedMessage.status, 402);
    const unlock = await request('/api/messages/unlock', { method: 'POST', token: clientToken, body: { receiver_id: creatorId } });
    assert.equal(unlock.status, 201);
    assert.equal(unlock.body.wallet.balance, 170);
    const message = await request('/api/messages', { method: 'POST', token: clientToken, body: { receiver_id: creatorId, text: 'Hola, ya habilité el chat.' } });
    assert.equal(message.status, 201);
    assert.equal((await request('/api/messages/typing', { method: 'POST', token: clientToken, body: { receiver_id: creatorId, typing: true } })).status, 200);
    assert.equal((await request(`/api/messages/typing?partner_id=${clientId}`, { token: creatorToken })).body.typing, true, 'el indicador de escritura debe funcionar entre cuentas');
    assert.equal((await request('/api/messages/typing', { method: 'POST', token: clientToken, body: { receiver_id: creatorId, typing: false } })).status, 200);
    assert.equal((await request(`/api/messages/typing?partner_id=${clientId}`, { token: creatorToken })).body.typing, false);
    const conversation = await request('/api/messages/conversations', { token: creatorToken });
    assert.equal(conversation.body.conversations.some(item => item.partner_id === clientId), true);

    const tip = await request('/api/tips', { method: 'POST', token: clientToken, body: { receiver_id: creatorId, amount: 25 } });
    assert.equal(tip.status, 201);
    assert.equal(tip.body.wallet.balance, 145);
    const clientWallet = await request('/api/wallet', { token: clientToken });
    const creatorWallet = await request('/api/wallet', { token: creatorToken });
    assert.equal(clientWallet.body.balance, 145);
    assert.equal(creatorWallet.body.balance, 35, 'el creador recibe 10 del aporte y 25 del tip');
    assert.equal(clientWallet.body.transactions.some(item => item.type === 'message_contribution'), true);
    assert.equal(clientWallet.body.transactions.some(item => item.type === 'tip'), true);
    assert.equal(creatorWallet.body.transactions.some(item => item.type === 'tip_received'), true);
    const publication = db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(creatorId));
    assert.equal(publication.plan,'pro');
    publication.expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal((await request('/api/profiles')).body.profiles.some(item => item.id === profile.body.profile.id),true,'el vencimiento de una membresía no debe retirar un perfil aprobado');
    assert.equal((await request(`/api/profiles/${profile.body.profile.id}`)).status,200);
    assert.equal((await request(`/api/creator/posts/${post.body.post.id}/unlock`, { method:'POST',token:clientToken,body:{} })).status,201,'la compra de contenido sigue disponible aunque la membresía venza');
    const renewal = await request('/api/creator/publication-plan', { method:'POST',token:creatorToken,body:{plan:'elite',operation_code:'QA-WEEK-456'} });
    assert.equal(renewal.status,201);
    assert.equal((await request(`/api/moderation/payments/${renewal.body.payment.id}`, { method:'PATCH',token:rootToken,body:{decision:'approved'} })).status,200);
    assert.equal((await request('/api/profiles')).body.profiles.some(item => item.id === profile.body.profile.id),true);
    assert.equal(publication.plan,'elite');
  } finally {
    uploadedFiles.forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    await new Promise(resolve => server.close(resolve));
  }
});
