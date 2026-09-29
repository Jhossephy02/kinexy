require('dotenv').config();
const { initDatabase } = require('../src/database/connection');

async function grantElite() {
  const db = await initDatabase();
  const now = new Date();
  // This script is deliberately manual: run it once at the migration moment.
  // Future registrations continue using the normal free weekly plan.
  const lifetimeExpiry = '2099-12-31T23:59:59.000Z';
  try {
    if (db.mode === 'postgres') {
      // Older installations only allowed the legacy plan identifiers.
      // Upgrade that constraint before assigning the current Elite plan.
      await db.pool.query("ALTER TABLE creator_publication_subscriptions DROP CONSTRAINT IF EXISTS creator_publication_subscriptions_plan_check");
      await db.pool.query("UPDATE creator_publication_subscriptions SET plan=CASE plan WHEN 'basico' THEN 'free' WHEN 'destacado' THEN 'plus' WHEN 'premium' THEN 'pro' ELSE plan END");
      await db.pool.query("ALTER TABLE creator_publication_subscriptions ADD CONSTRAINT creator_publication_subscriptions_plan_check CHECK (plan IN ('free','plus','pro','elite'))");
      const result = await db.pool.query("INSERT INTO creator_publication_subscriptions (user_id,plan,starts_at,expires_at,payment_id) SELECT id,'elite',NOW(),TIMESTAMPTZ '2099-12-31 23:59:59+00',NULL FROM users WHERE role='creator' ON CONFLICT (user_id) DO UPDATE SET plan='elite',starts_at=NOW(),expires_at=TIMESTAMPTZ '2099-12-31 23:59:59+00',payment_id=NULL RETURNING user_id");
      console.log(`Elite vitalicio activado para ${result.rowCount} cuenta(s) de creador existentes.`);
      return;
    }

    const creators = db.users.filter(user => user.role === 'creator');
    for (const creator of creators) {
      const current = db.creator_publication_subscriptions.find(item => Number(item.user_id) === Number(creator.id));
      if (current) Object.assign(current, { plan:'elite', starts_at:now.toISOString(), expires_at:lifetimeExpiry, payment_id:null });
      else db.creator_publication_subscriptions.push({ user_id:creator.id, plan:'elite', starts_at:now.toISOString(), expires_at:lifetimeExpiry, payment_id:null });
    }
    await db.save();
    console.log(`Elite vitalicio activado para ${creators.length} cuenta(s) de creador existentes.`);
  } finally {
    if (db.mode === 'postgres') await db.pool.end();
  }
}

grantElite().catch(error => { console.error(error); process.exitCode = 1; });
