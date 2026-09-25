const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const profiles = [
  ['Valentina',24,'Pucallpa','Yarinacocha','Premium','4.9','Platino','premium','S/ 180','/demo-profiles/valentina.jpg','Lun a Sab, 2:00 pm - 11:00 pm','Perfil verificado con disponibilidad actualizada.'],
  ['Isabella',27,'Pucallpa','Manantay','Maduras','4.6','Platino','destacado','S/ 170','/demo-profiles/isabella.jpg','Con reserva','Publicación destacada con horarios publicados.'],
  ['Bianca',28,'Pucallpa','Callería','A Domicilio','4.7','Platino','destacado','S/ 180','/demo-profiles/bianca.jpg','Previa coordinación','Ficha completa con estado activo.'],
  ['Mateo',27,'Pucallpa','Avenida principal','Premium','4.9','Platino','premium','S/ 210','/demo-profiles/mateo.jpg','Previa cita','Creador de muestra con perfil de alta visibilidad.'],
  ['Diego',30,'Pucallpa','Yarinacocha','Económicas','4.6','Platino','destacado','S/ 160','/demo-profiles/diego.jpg','Noches','Anuncio destacado con renovación próxima.'],
  ['André',33,'Pucallpa','Callería','Premium','4.8','Platino','premium','S/ 190','/demo-profiles/andre.jpg','Previa reserva','Ficha premium para Pucallpa.'],
];

class PostgresDatabase {
  constructor(pool) { this.pool = pool; this.mode = 'postgres'; }
  nextId(items) { return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1; }
  async init() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await this.pool.query(schema);
    await this.pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS services TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_telegram TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_price_tokens INTEGER NOT NULL DEFAULT 10;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_price BOOLEAN NOT NULL DEFAULT TRUE;`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      UPDATE users SET role='superadmin' WHERE id=(SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE role='superadmin');
      UPDATE users SET role=CASE role WHEN 'user' THEN 'client' WHEN 'advertiser' THEN 'creator' ELSE role END;
      ALTER TABLE users ALTER COLUMN role SET DEFAULT 'client';
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('client','creator','moderator','admin','superadmin')) NOT VALID;
      ALTER TABLE users VALIDATE CONSTRAINT users_role_check;`);
    const count = await this.pool.query('SELECT COUNT(*)::int AS count FROM users');
    if (!count.rows[0].count) {
      const production = process.env.NODE_ENV === 'production';
      const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      if (production && (!email || !password || password.length < 12)) throw new Error('Configura BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres) antes del primer arranque.');
      const users = production ? [['Superadministrador',email,password,'superadmin']] : [['Superadministrador','admin','admin','superadmin'],['Cliente demo','usuario@demo.com','usuario','client'],['Creador demo','perfil@demo.com','perfil','creator']];
      for (const [name,email,password,role] of users) await this.pool.query('INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4)', [name,email,await bcrypt.hash(password,10),role]);
    }
    const ownerEmail = String(process.env.OWNER_SUPERADMIN_EMAIL || 'mjhossephy@gmail.com').trim().toLowerCase();
    await this.pool.query('UPDATE users SET role=$1 WHERE LOWER(email)=LOWER($2)', ['superadmin', ownerEmail]);
    const profileCount = await this.pool.query('SELECT COUNT(*)::int AS count FROM profiles');
    if (!profileCount.rows[0].count && process.env.NODE_ENV !== 'production') for (const p of profiles) await this.pool.query('INSERT INTO profiles (name,age,city,area,category,rating,tier,plan,price,photo,schedule,description,approved) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)', p);
    const planCount = await this.pool.query('SELECT COUNT(*)::int AS count FROM membership_plans');
    if (!planCount.rows[0].count) {
      const plans = [['Esencial',19,'Publicaciones exclusivas y novedades de tus creadores favoritos.',['Contenido exclusivo','Novedades del creador']],['Plus',39,'Acceso anticipado, encuestas y una experiencia más cercana.',['Todo en Esencial','Acceso anticipado','Encuestas para miembros']],['Premium',69,'La experiencia completa de comunidad con encuentros grupales programados.',['Todo en Plus','Eventos grupales','Insignia Premium']]];
      for (const [name,price,description,benefits] of plans) await this.pool.query('INSERT INTO membership_plans (name,price,currency,description,benefits) VALUES ($1,$2,$3,$4,$5)',[name,price,'PEN',description,JSON.stringify(benefits)]);
    }
    await this.pool.query("INSERT INTO creator_store (id,payload) VALUES (1,'{}'::jsonb) ON CONFLICT (id) DO NOTHING");
    const creatorState = await this.pool.query('SELECT payload FROM creator_store WHERE id=1');
    const stored = creatorState.rows[0]?.payload || {};
    const persistedCollections = ['creator_posts','creator_sales','creator_audience','creator_lives','creator_live_moderators','messages','message_unlocks','tips','comments','profile_reviews','post_likes','membership_subscriptions','notifications','payments'];
    for (const key of persistedCollections) this[key] = Array.isArray(stored[key]) ? stored[key] : [];
    this.role_permissions = stored.role_permissions && typeof stored.role_permissions === 'object' ? stored.role_permissions : {};
    this.users = (await this.pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY id')).rows;
    this.profiles = (await this.pool.query('SELECT * FROM profiles ORDER BY id')).rows;
    this.moderation_reports = (await this.pool.query('SELECT * FROM moderation_reports ORDER BY id')).rows;
    this.token_transactions = [];
    this.token_wallets = [];
    this.token_unlocks = [];
    const postUnlocks = await this.pool.query('SELECT id,user_id,post_id,created_at FROM post_unlocks');
    this.post_unlocks = postUnlocks.rows;
    const contactUnlocks = await this.pool.query('SELECT id,user_id,profile_id,created_at FROM contact_unlocks');
    this.contact_unlocks = contactUnlocks.rows;
  }
  async save() {
    const payload = JSON.stringify({ creator_posts:this.creator_posts, creator_sales:this.creator_sales, creator_audience:this.creator_audience, creator_lives:this.creator_lives, creator_live_moderators:this.creator_live_moderators, messages:this.messages, message_unlocks:this.message_unlocks, tips:this.tips, comments:this.comments, profile_reviews:this.profile_reviews, post_likes:this.post_likes, membership_subscriptions:this.membership_subscriptions, notifications:this.notifications, payments:this.payments, role_permissions:this.role_permissions });
    await this.pool.query("INSERT INTO creator_store (id,payload,updated_at) VALUES (1,$1::jsonb,NOW()) ON CONFLICT (id) DO UPDATE SET payload=$1::jsonb,updated_at=NOW()", [payload]);
  }
  async findUser(email) { const r = await this.pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]); return r.rows[0]; }
  async getUser(id) { const r = await this.pool.query('SELECT id,name,email,role,created_at FROM users WHERE id=$1', [id]); return r.rows[0]; }
  async createUser({ name,email,password,role,date_of_birth }) { const r = await this.pool.query('INSERT INTO users (name,email,password,role,date_of_birth,adult_confirmed_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id,name,email,role,created_at', [name,email,password,role,date_of_birth||null]); this.users.push(r.rows[0]); return r.rows[0]; }
  async listProfiles({ city, category, betaFree=false }) { const values=[]; const where=['approved=TRUE','active=TRUE']; if(!betaFree) where.push("(owner_id IS NULL OR EXISTS (SELECT 1 FROM creator_publication_subscriptions s WHERE s.user_id=profiles.owner_id AND s.expires_at>NOW()))"); if(city){values.push(city);where.push(`city=$${values.length}`);} if(category && category!=='Todos'){values.push(category);where.push(`category=$${values.length}`);} const r=await this.pool.query(`SELECT profiles.*,COALESCE(s.plan,profiles.plan) AS plan FROM profiles LEFT JOIN creator_publication_subscriptions s ON s.user_id=profiles.owner_id AND s.expires_at>NOW() WHERE ${where.join(' AND ')} ORDER BY CASE COALESCE(s.plan,profiles.plan) WHEN 'premium' THEN 0 WHEN 'destacado' THEN 1 ELSE 2 END,profiles.id DESC`,values); return r.rows; }
  async listOwnerProfiles(ownerId) { const r=await this.pool.query('SELECT * FROM profiles WHERE owner_id=$1 ORDER BY id DESC',[ownerId]); return r.rows; }
  async getProfile(id) { const r=await this.pool.query('SELECT * FROM profiles WHERE id=$1',[id]); return r.rows[0]; }
  async getContactUnlock(userId, profileId) { const r=await this.pool.query('SELECT id,user_id,profile_id,created_at FROM contact_unlocks WHERE user_id=$1 AND profile_id=$2',[userId,profileId]); return r.rows[0]; }
  async createProfile(data, ownerId, approved=false) { const r=await this.pool.query('INSERT INTO profiles (owner_id,name,age,city,area,category,plan,price,photo,photos,schedule,description,identity,services,contact_whatsapp,contact_telegram,contact_price_tokens,show_price,approved) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *',[ownerId,data.name,data.age,data.city,data.area,data.category,data.plan||'basico',data.price,data.photo,JSON.stringify(data.photos || []),data.schedule,data.description,data.identity,data.services,data.contact_whatsapp,data.contact_telegram,data.contact_price_tokens ?? 10,data.show_price !== false,approved]); this.profiles.push(r.rows[0]); return r.rows[0]; }
  async updateProfile(id,data,ownerId) { const r=await this.pool.query('UPDATE profiles SET name=COALESCE($1,name),age=COALESCE($2,age),city=COALESCE($3,city),area=COALESCE($4,area),category=COALESCE($5,category),plan=COALESCE($6,plan),price=COALESCE($7,price),photo=COALESCE($8,photo),photos=COALESCE($9::jsonb,photos),schedule=COALESCE($10,schedule),description=COALESCE($11,description),identity=COALESCE($12,identity),services=COALESCE($13,services),contact_whatsapp=COALESCE($14,contact_whatsapp),contact_telegram=COALESCE($15,contact_telegram),contact_price_tokens=COALESCE($16,contact_price_tokens),show_price=COALESCE($17,show_price),updated_at=NOW() WHERE id=$18 AND ($19::bigint IS NULL OR owner_id=$19) RETURNING *',[data.name,data.age,data.city,data.area,data.category,data.plan,data.price,data.photo,data.photos === undefined ? null : JSON.stringify(data.photos),data.schedule,data.description,data.identity,data.services,data.contact_whatsapp,data.contact_telegram,data.contact_price_tokens,data.show_price,id,ownerId||null]); if(r.rows[0]) { const i=this.profiles.findIndex(x=>Number(x.id)===Number(id)); if(i>=0)this.profiles[i]=r.rows[0]; } return r.rows[0]; }
  async approveProfile(id, approved) { const r=await this.pool.query('UPDATE profiles SET approved=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[approved,id]); if(r.rows[0]) { const i=this.profiles.findIndex(x=>Number(x.id)===Number(id)); if(i>=0)this.profiles[i]=r.rows[0]; } return r.rows[0]; }
  async listUsers() { const r=await this.pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY id'); return r.rows; }
  async createManagedUser({ name,email,password,role }) { const r=await this.pool.query('INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,created_at',[name,email,password,role]); this.users.push(r.rows[0]); return r.rows[0]; }
  async updateUserRole(id, role) { const r=await this.pool.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role,created_at',[role,id]); if(r.rows[0]) { const i=this.users.findIndex(x=>Number(x.id)===Number(id)); if(i>=0)this.users[i]=r.rows[0]; } return r.rows[0]; }
  async deleteUser(id) { const r=await this.pool.query('DELETE FROM users WHERE id=$1 RETURNING id',[id]); if(r.rows[0]) this.users=this.users.filter(x=>Number(x.id)!==Number(id)); return r.rows[0]; }
  async countRole(role) { const r=await this.pool.query('SELECT COUNT(*)::int count FROM users WHERE role=$1',[role]); return r.rows[0].count; }
  async listMembershipPlans() { const r=await this.pool.query('SELECT * FROM membership_plans WHERE active=TRUE ORDER BY price,id'); return r.rows.map(plan => ({...plan, price:Number(plan.price)})); }
  async createMembershipPlan(data, creatorId) { const r=await this.pool.query('INSERT INTO membership_plans (creator_id,name,price,currency,description,benefits) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[creatorId,data.name,data.price,data.currency,data.description,JSON.stringify(data.benefits)]); return {...r.rows[0],price:Number(r.rows[0].price)}; }
  async listPendingProfiles() { const r=await this.pool.query('SELECT * FROM profiles WHERE approved=FALSE ORDER BY created_at'); return r.rows; }
  async listModerationReports() { const r=await this.pool.query(`SELECT r.*,p.name AS profile_name,u.name AS reporter_name FROM moderation_reports r LEFT JOIN profiles p ON p.id=r.profile_id LEFT JOIN users u ON u.id=r.reporter_id ORDER BY CASE r.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,r.created_at`); return r.rows; }
  async resolveModerationReport(id, status, moderatorId, note) { const r=await this.pool.query("UPDATE moderation_reports SET status=$1,assigned_to=$2,resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN NOW() ELSE NULL END WHERE id=$3 RETURNING *",[status,moderatorId,id]); if(!r.rows[0]) return null; const i=this.moderation_reports.findIndex(x=>Number(x.id)===Number(id)); if(i>=0)this.moderation_reports[i]=r.rows[0]; await this.logModerationAction(moderatorId,'report',id,status,note); return r.rows[0]; }
  async logModerationAction(moderatorId,targetType,targetId,action,note='') { const r=await this.pool.query('INSERT INTO moderation_actions (moderator_id,target_type,target_id,action,note) VALUES ($1,$2,$3,$4,$5) RETURNING *',[moderatorId,targetType,targetId,action,note]); return r.rows[0]; }
  async listModerationActions() { const r=await this.pool.query('SELECT a.*,u.name AS moderator_name FROM moderation_actions a LEFT JOIN users u ON u.id=a.moderator_id ORDER BY a.created_at DESC LIMIT 100'); return r.rows; }
  async getCreatorPublication(userId) { const r=await this.pool.query('SELECT * FROM creator_publication_subscriptions WHERE user_id=$1',[userId]); return r.rows[0] || null; }
  async createManualPayment(userId, tokens, soles, code, purpose='tokens', plan=null) {
    const r = await this.pool.query("INSERT INTO manual_payments (user_id,amount_tokens,amount_pen,operation_code,purpose,publication_plan) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [userId,tokens,soles,code,purpose,plan]);
    return r.rows[0];
  }
  async listManualPayments(userId = null) {
    const r = await this.pool.query(`SELECT p.*,u.name AS user_name,u.email AS user_email FROM manual_payments p JOIN users u ON u.id=p.user_id ${userId ? 'WHERE p.user_id=$1' : ''} ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,p.created_at DESC LIMIT 200`, userId ? [userId] : []);
    return r.rows;
  }
  async reviewManualPayment(id, reviewerId, decision, note) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('SELECT * FROM manual_payments WHERE id=$1 FOR UPDATE', [id]);
      const payment = r.rows[0];
      if (!payment || payment.status !== 'pending') { await client.query('ROLLBACK'); return null; }
      const updated = await client.query('UPDATE manual_payments SET status=$1,reviewer_id=$2,review_note=$3,reviewed_at=NOW() WHERE id=$4 RETURNING *', [decision,reviewerId,note,id]);
      if (decision === 'approved' && payment.purpose === 'creator_publication') {
        await client.query("INSERT INTO creator_publication_subscriptions (user_id,plan,starts_at,expires_at,payment_id) VALUES ($1,$2,NOW(),NOW()+INTERVAL '7 days',$3) ON CONFLICT (user_id) DO UPDATE SET plan=$2,starts_at=NOW(),expires_at=GREATEST(creator_publication_subscriptions.expires_at,NOW())+INTERVAL '7 days',payment_id=$3",[payment.user_id,payment.publication_plan,payment.id]);
      } else if (decision === 'approved') {
        await client.query('INSERT INTO token_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [payment.user_id]);
        await client.query('UPDATE token_wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2', [payment.amount_tokens,payment.user_id]);
        await client.query("INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,'manual_yape_credit',$3,$4)", [payment.user_id,payment.amount_tokens,`Recarga Yape aprobada: ${payment.amount_tokens} tokens`,String(payment.id)]);
      }
      await client.query('INSERT INTO moderation_actions (moderator_id,target_type,target_id,action,note) VALUES ($1,$2,$3,$4,$5)', [reviewerId,'manual_payment',id,decision,note]);
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async getTokenWallet(userId) { await this.pool.query('INSERT INTO token_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[userId]); const [wallet,transactions,unlocks]=await Promise.all([this.pool.query('SELECT balance,updated_at FROM token_wallets WHERE user_id=$1',[userId]),this.pool.query('SELECT id,amount,type,description,reference,created_at FROM token_transactions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',[userId]),this.pool.query('SELECT product_id FROM token_unlocks WHERE user_id=$1',[userId])]); return { balance:wallet.rows[0].balance,updated_at:wallet.rows[0].updated_at,transactions:transactions.rows,unlocks:unlocks.rows.map(row=>row.product_id) }; }
  async creditDemoTokens(userId, amount, method) { const client=await this.pool.connect(); try { await client.query('BEGIN'); await client.query('INSERT INTO token_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[userId]); const wallet=await client.query('UPDATE token_wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2 RETURNING balance,updated_at',[amount,userId]); const transaction=await client.query("INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,'demo_credit',$3,$4) RETURNING *",[userId,amount,`Recarga de prueba: ${amount} tokens`,method]); await client.query('COMMIT'); return { wallet:wallet.rows[0],transaction:transaction.rows[0] }; } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async spendTokens(userId, product) { const client=await this.pool.connect(); try { await client.query('BEGIN'); await client.query('INSERT INTO token_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[userId]); const prior=await client.query('SELECT 1 FROM token_unlocks WHERE user_id=$1 AND product_id=$2',[userId,product.id]); if(prior.rows.length){const wallet=await client.query('SELECT balance,updated_at FROM token_wallets WHERE user_id=$1',[userId]);await client.query('COMMIT');return {wallet:wallet.rows[0],already_unlocked:true};} const wallet=await client.query('UPDATE token_wallets SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance,updated_at',[product.cost,userId]); if(!wallet.rows[0]){await client.query('ROLLBACK');return null;} await client.query('INSERT INTO token_unlocks (user_id,product_id) VALUES ($1,$2)',[userId,product.id]); const transaction=await client.query("INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,'content_unlock',$3,$4) RETURNING *",[userId,-product.cost,`Desbloqueo: ${product.title}`,product.id]); await client.query('COMMIT'); return {wallet:wallet.rows[0],transaction:transaction.rows[0],already_unlocked:false}; } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async unlockPost(userId, post) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO token_wallets (user_id) VALUES ($1),($2) ON CONFLICT DO NOTHING', [userId, post.creator_id]);
      const prior = await client.query('SELECT id,user_id,post_id,created_at FROM post_unlocks WHERE user_id=$1 AND post_id=$2', [userId, post.id]);
      if (prior.rows[0]) { const wallet = await client.query('SELECT balance FROM token_wallets WHERE user_id=$1', [userId]); await client.query('COMMIT'); return { already_unlocked: true, wallet: wallet.rows[0], unlock: prior.rows[0] }; }
      const amount = Number(post.price_tokens);
      const sender = await client.query('UPDATE token_wallets SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance', [amount, userId]);
      if (!sender.rows[0]) { await client.query('ROLLBACK'); return null; }
      await client.query('UPDATE token_wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2', [amount, post.creator_id]);
      const unlock = await client.query('INSERT INTO post_unlocks (user_id,post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id,user_id,post_id,created_at', [userId, post.id]);
      if (!unlock.rows[0]) { await client.query('ROLLBACK'); const wallet = await client.query('SELECT balance FROM token_wallets WHERE user_id=$1', [userId]); return { already_unlocked: true, wallet: wallet.rows[0] }; }
      await client.query("INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,'content_unlock',$3,$4),($5,$6,'content_unlock',$7,$4)", [userId, -amount, `Desbloqueo: ${post.title}`, `post:${post.id}`, post.creator_id, amount, `Venta: ${post.title}`]);
      await client.query('COMMIT');
      return { already_unlocked: false, wallet: sender.rows[0], unlock: unlock.rows[0] };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async unlockContact(userId, profile) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO token_wallets (user_id) VALUES ($1),($2) ON CONFLICT DO NOTHING', [userId, profile.owner_id]);
      const prior = await client.query('SELECT id,user_id,profile_id,created_at FROM contact_unlocks WHERE user_id=$1 AND profile_id=$2', [userId, profile.id]);
      if (prior.rows[0]) { const wallet = await client.query('SELECT balance FROM token_wallets WHERE user_id=$1', [userId]); await client.query('COMMIT'); return { already_unlocked: true, wallet: wallet.rows[0], unlock: prior.rows[0] }; }
      const amount = Number(profile.contact_price_tokens || 10);
      const sender = await client.query('UPDATE token_wallets SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance', [amount, userId]);
      if (!sender.rows[0]) { await client.query('ROLLBACK'); return null; }
      await client.query('UPDATE token_wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2', [amount, profile.owner_id]);
      const unlock = await client.query('INSERT INTO contact_unlocks (user_id,profile_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id,user_id,profile_id,created_at', [userId, profile.id]);
      if (!unlock.rows[0]) { await client.query('ROLLBACK'); const wallet = await client.query('SELECT balance FROM token_wallets WHERE user_id=$1', [userId]); return { already_unlocked: true, wallet: wallet.rows[0] }; }
      await client.query("INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,'content_unlock',$3,$4),($5,$6,'content_unlock',$7,$4)", [userId, -amount, `Contacto: ${profile.name}`, `contact:${profile.id}`, profile.owner_id, amount, `Contacto desbloqueado: ${profile.name}`]);
      await client.query('COMMIT');
      return { already_unlocked: false, wallet: sender.rows[0], unlock: unlock.rows[0] };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async createModerationReport({ profileId, reporterId, reason, details, priority }) {
    const r = await this.pool.query('INSERT INTO moderation_reports (profile_id,reporter_id,reason,details,priority) VALUES ($1,$2,$3,$4,$5) RETURNING *',[profileId,reporterId,reason,details,priority]);
    this.moderation_reports.push(r.rows[0]); return r.rows[0];
  }
  async debitTokens(userId, amount, type, description, reference) {
    const client=await this.pool.connect(); try { await client.query('BEGIN'); await client.query('INSERT INTO token_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[userId]); const wallet=await client.query('UPDATE token_wallets SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance,updated_at',[amount,userId]); if(!wallet.rows[0]){await client.query('ROLLBACK');return null;} const transaction=await client.query('INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,$3,$4,$5) RETURNING *',[userId,-amount,type,description,reference]); await client.query('COMMIT'); return {wallet:wallet.rows[0],transaction:transaction.rows[0]}; } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
  }
  async transferTokens(senderId, recipientId, amount, type, description) {
    const client=await this.pool.connect(); try { await client.query('BEGIN'); await client.query('INSERT INTO token_wallets (user_id) VALUES ($1),($2) ON CONFLICT DO NOTHING',[senderId,recipientId]); const sender=await client.query('UPDATE token_wallets SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance,updated_at',[amount,senderId]); if(!sender.rows[0]){await client.query('ROLLBACK');return null;} const recipient=await client.query('UPDATE token_wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2 RETURNING balance,updated_at',[amount,recipientId]); const now=new Date().toISOString(); await client.query('INSERT INTO token_transactions (user_id,amount,type,description,reference) VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)',[senderId,-amount,type,description,`user:${recipientId}`,recipientId,amount,`${type}_received`,`Recibido: ${description}`,`user:${senderId}`]); await client.query('COMMIT'); return {sender:sender.rows[0],recipient:recipient.rows[0],createdAt:now}; } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
  }

}

async function connectPostgres(url) { const pool = new Pool({ connectionString: url, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false }); await pool.query('SELECT 1'); const db = new PostgresDatabase(pool); await db.init(); return db; }
module.exports = { connectPostgres };

