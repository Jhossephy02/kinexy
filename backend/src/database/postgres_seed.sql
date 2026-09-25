-- Kinexy: creación de base y datos iniciales para PostgreSQL
-- Ejecutar primero: CREATE DATABASE kinexy;
-- Luego conectarse a kinexy y ejecutar este archivo.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'advertiser', 'admin')),
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
  schedule TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_city_idx ON profiles(city);
CREATE INDEX IF NOT EXISTS profiles_category_idx ON profiles(category);
CREATE INDEX IF NOT EXISTS profiles_approved_idx ON profiles(approved);

INSERT INTO users (id, name, email, password, role) VALUES
(1, 'Administrador', 'admin', '$2a$10$5b5XL5zzJwfo5tiV8kGS7uQYnre/cie2SRsCrPUqvQSTeXzyhvMam', 'admin'),
(2, 'Usuario demo', 'usuario@demo.com', '$2a$10$ZzS18urRv7H.ZONpN37EseCq08eFKiJxQhwwxAtqcF5Cqnbh7vrW.', 'user'),
(3, 'Perfil demo', 'perfil@demo.com', '$2a$10$tLrej80Ws.9uz4SLQbVmHOPzAKbFSpOV2cDOL8kq9z5DH2O1wR66G', 'advertiser')
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, name, age, city, area, category, rating, tier, plan, active, approved, price, photo, schedule, description) VALUES
(1, 'Valentina', 24, 'Pucallpa', 'Yarinacocha', 'Premium', 4.9, 'Platino', 'premium', TRUE, TRUE, 'S/ 180', '/demo-profiles/valentina.jpg', 'Lun a Sab, 2:00 pm - 11:00 pm', 'Perfil verificado con disponibilidad actualizada.'),
(2, 'Isabella', 27, 'Pucallpa', 'Manantay', 'Maduras', 4.6, 'Platino', 'destacado', TRUE, TRUE, 'S/ 170', '/demo-profiles/isabella.jpg', 'Con reserva', 'Publicación destacada con horarios publicados.'),
(3, 'Bianca', 28, 'Pucallpa', 'Callería', 'A Domicilio', 4.7, 'Platino', 'destacado', TRUE, TRUE, 'S/ 180', '/demo-profiles/bianca.jpg', 'Previa coordinación', 'Ficha completa con estado activo.'),
(4, 'Mateo', 27, 'Pucallpa', 'Avenida principal', 'Premium', 4.9, 'Platino', 'premium', TRUE, TRUE, 'S/ 210', '/demo-profiles/mateo.jpg', 'Previa cita', 'Creador de muestra con perfil de alta visibilidad.'),
(5, 'Diego', 30, 'Pucallpa', 'Yarinacocha', 'Económicas', 4.6, 'Platino', 'destacado', TRUE, TRUE, 'S/ 160', '/demo-profiles/diego.jpg', 'Noches', 'Anuncio destacado con renovación próxima.'),
(6, 'André', 33, 'Pucallpa', 'Callería', 'Premium', 4.8, 'Platino', 'premium', TRUE, TRUE, 'S/ 190', '/demo-profiles/andre.jpg', 'Previa reserva', 'Ficha premium para Pucallpa.')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('profiles', 'id'), COALESCE((SELECT MAX(id) FROM profiles), 1));
