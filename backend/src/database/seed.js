require('dotenv').config();
const { initDatabase } = require('./connection');

initDatabase().then((db) => {
  console.log(`Seed listo usando ${db.mode}. Usuarios: ${db.users.length}. Perfiles: ${db.profiles.length}.`);
  if (db.pool) return db.pool.end();
}).catch((error) => { console.error('Error ejecutando seed:', error); process.exit(1); });
