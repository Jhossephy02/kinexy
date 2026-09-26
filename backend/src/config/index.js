/**
 * Kinexy Backend – Configuration
 * Reads from .env with sensible defaults
 */
const path = require('path');

module.exports = {
  PORT:          process.env.PORT || 8000,
  JWT_SECRET:    process.env.JWT_SECRET || 'kinexy_dev_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DB_PATH:       path.resolve(process.env.DB_PATH || './data/kinexy.db'),
  DATABASE_URL:  process.env.DATABASE_URL || '',
  UPLOAD_DIR:    path.resolve(process.env.UPLOAD_DIR || './uploads'),
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '8388608', 10),
  FRONTEND_URL:  process.env.FRONTEND_URL || 'http://localhost:5173',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  OWNER_SUPERADMIN_EMAIL: (process.env.OWNER_SUPERADMIN_EMAIL || 'mjhossephy@gmail.com').trim().toLowerCase(),
  // La plataforma inicia con publicación gratuita; activar cobro requiere BETA_FREE_ACCESS=false.
  BETA_FREE_ACCESS: String(process.env.BETA_FREE_ACCESS || 'true').toLowerCase() === 'true',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || '',
  PAYMENT_API_KEY: process.env.PAYMENT_API_KEY || '',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || '',
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',
  NODE_ENV:      process.env.NODE_ENV || 'development',
};
