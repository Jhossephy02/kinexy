require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { initDatabase } = require('../src/database/connection');

async function removeQaProfile() {
  const db = await initDatabase();
  try {
    if (db.mode === 'postgres') {
      const result = await db.pool.query("DELETE FROM profiles WHERE LOWER(TRIM(name))='qa perfil full' RETURNING id,name");
      console.log(`Se eliminaron ${result.rowCount} perfil(es) QA.`);
    } else {
      const ids = new Set(db.profiles.filter(profile => String(profile.name || '').trim().toLowerCase() === 'qa perfil full').map(profile => Number(profile.id)));
      db.profiles.splice(0, db.profiles.length, ...db.profiles.filter(profile => !ids.has(Number(profile.id))));
      for (const key of ['profile_views','profile_likes','profile_reviews','moderation_reports']) if (Array.isArray(db[key])) db[key].splice(0, db[key].length, ...db[key].filter(item => !ids.has(Number(item.profile_id))));
      await db.save();
      console.log(`Se eliminaron ${ids.size} perfil(es) QA.`);
    }
    const placeholder = path.join(config.UPLOAD_DIR, 'qa-placeholder.png');
    if (fs.existsSync(placeholder)) fs.unlinkSync(placeholder);
  } finally {
    if (db.mode === 'postgres') await db.pool.end();
  }
}

removeQaProfile().catch(error => { console.error(error); process.exitCode = 1; });
