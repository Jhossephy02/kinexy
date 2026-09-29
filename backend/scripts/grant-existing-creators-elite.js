require('dotenv').config();
const { initDatabase } = require('../src/database/connection');

async function grantElite() {
  const db = await initDatabase();
  const now = new Date();
  try {
    if (db.mode === 'postgres') {
      const result = await db.pool.query("INSERT INTO creator_publication_subscriptions (user_id,plan,starts_at,expires_at,payment_id) SELECT id,'elite',NOW(),NOW()+INTERVAL '7 days',NULL FROM users WHERE role='creator' ON CONFLICT (user_id) DO UPDATE SET plan='elite',starts_at=NOW(),expires_at=GREATEST(creator_publication_subscriptions.expires_at,NOW())+INTERVAL '7 days',payment_id=NULL RETURNING user_id");
      console.log(`Elite activado para ${result.rowCount} cuenta(s) de creador hasta por 7 días.`);
      return;
    }

    const creators = db.users.filter(user => user.role === 'creator');
    for (const creator of creators) {
      const current = db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(creator.id));
      const expiresAt = new Date(Math.max(now.getTime(), new Date(current?.expires_at || 0).getTime()) + 7 * 86400000).toISOString();
      if (current) Object.assign(current, { plan:'elite', starts_at:now.toISOString(), expires_at:expiresAt, payment_id:null });
      else db.creator_publication_subscriptions.push({ user_id:creator.id, plan:'elite', starts_at:now.toISOString(), expires_at:expiresAt, payment_id:null });
    }
    await db.save();
    console.log(`Elite activado para ${creators.length} cuenta(s) de creador hasta por 7 días.`);
  } finally {
    if (db.mode === 'postgres') await db.pool.end();
  }
}

grantElite().catch(error => { console.error(error); process.exitCode = 1; });
