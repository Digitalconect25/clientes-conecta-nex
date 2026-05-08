-- ==================================================================
-- MIGRACION V2 - Pipeline de fases, Accesos cifrados, mejoras
-- ==================================================================
-- Para ejecutar: copia y pega TODO en el SQL Editor de Neon, en tu
-- proyecto "Clientes Conecta Nex" -> SQL Editor, y pulsa "Run".
-- Este script es seguro de ejecutar varias veces (idempotente).
-- ==================================================================

-- 1. Tabla pagos (si no existe)
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  importe NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_esperada DATE,
  fecha_pago DATE,
  metodo TEXT DEFAULT 'Transferencia',
  estado TEXT DEFAULT 'Pendiente',
  es_recurrente BOOLEAN DEFAULT FALSE,
  mes_recurrencia TEXT,
  notas TEXT DEFAULT '',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- 2. Campos de seguimiento de proyecto en clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado_proyecto TEXT DEFAULT 'Sin iniciar';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS porcentaje_avance INTEGER DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_fin_prevista DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_fin_real DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS notas_proyecto TEXT DEFAULT '';

-- 3. NUEVA TABLA: Fases del proyecto (pipeline real)
CREATE TABLE IF NOT EXISTS fases (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  peso INTEGER NOT NULL DEFAULT 10,
  fecha_prevista_inicio DATE,
  fecha_prevista_fin DATE,
  fecha_real_inicio DATE,
  fecha_real_fin DATE,
  notas TEXT DEFAULT '',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW(),
  CONSTRAINT estado_fase_valido CHECK (estado IN ('Pendiente', 'En curso', 'Bloqueada', 'Completada'))
);
CREATE INDEX IF NOT EXISTS idx_fases_cliente ON fases(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fases_estado ON fases(estado);

-- 4. NUEVA TABLA: Accesos y credenciales del cliente (cifradas)
CREATE TABLE IF NOT EXISTS accesos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  etiqueta TEXT NOT NULL,
  url TEXT DEFAULT '',
  usuario TEXT DEFAULT '',
  password_cifrado TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  importante BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accesos_cliente ON accesos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_accesos_categoria ON accesos(categoria);

-- 5. Rate limiting de login
CREATE TABLE IF NOT EXISTS intentos_login (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  exitoso BOOLEAN DEFAULT FALSE,
  cuando TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intentos_ip_cuando ON intentos_login(ip, cuando DESC);

-- ==================================================================
-- IMPORTANTE: Tras correr esta migracion, anade en Vercel
-- (Settings -> Environment Variables) estas dos variables:
--
-- ACCESS_ENCRYPTION_KEY = clave hex de 64 caracteres (32 bytes).
--   Genera una en tu terminal con:
--   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--   IMPORTANTE: una vez metida, NO la cambies. Si cambias la clave,
--   las contrasenas guardadas dejaran de poder descifrarse.
--
-- RESEND_API_KEY = (opcional) API key de resend.com para enviar
--   actas de entrega por email. Sin esto, el boton aparece deshabilitado.
--
-- RESEND_FROM_EMAIL = (opcional) email remitente verificado en Resend.
--   Ejemplo: actas@conectanex.com
-- ==================================================================
