CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'creator', 'moderator', 'admin', 'superadmin')),
  date_of_birth DATE,
  adult_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  category TEXT NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Platino',
  plan TEXT NOT NULL DEFAULT 'basico',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  price TEXT,
  photo TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  identity TEXT,
  services TEXT,
  contact_whatsapp TEXT,
  contact_telegram TEXT,
  contact_price_tokens INTEGER NOT NULL DEFAULT 10,
  show_price BOOLEAN NOT NULL DEFAULT TRUE,
  schedule TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_city_idx ON profiles(city);
CREATE INDEX IF NOT EXISTS profiles_category_idx ON profiles(category);
CREATE INDEX IF NOT EXISTS profiles_approved_idx ON profiles(approved);

CREATE TABLE IF NOT EXISTS membership_plans (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD')),
  description TEXT NOT NULL DEFAULT '',
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  profile_id BIGINT REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id BIGSERIAL PRIMARY KEY,
  moderator_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_tokens INTEGER NOT NULL CHECK (amount_tokens >= 0),
  amount_pen NUMERIC(10,2) NOT NULL CHECK (amount_pen > 0),
  provider TEXT NOT NULL DEFAULT 'yape',
  purpose TEXT NOT NULL DEFAULT 'tokens',
  publication_plan TEXT,
  operation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'tokens';
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS publication_plan TEXT;
ALTER TABLE manual_payments DROP CONSTRAINT IF EXISTS manual_payments_amount_tokens_check;
ALTER TABLE manual_payments ADD CONSTRAINT manual_payments_amount_tokens_check CHECK (amount_tokens >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS manual_payments_provider_code_idx ON manual_payments(provider, operation_code);

CREATE TABLE IF NOT EXISTS creator_publication_subscriptions (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','plus','pro','elite')),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  payment_id BIGINT REFERENCES manual_payments(id)
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  type TEXT NOT NULL CHECK (type IN ('demo_credit','content_unlock')),
  description TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_type_check;

CREATE TABLE IF NOT EXISTS token_unlocks (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS post_unlocks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS contact_unlocks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, profile_id)
);

CREATE INDEX IF NOT EXISTS token_transactions_user_idx ON token_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_tokens INTEGER NOT NULL CHECK (amount_tokens > 0),
  method TEXT NOT NULL CHECK (method IN ('yape','bank')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx ON withdrawal_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creator_store (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
