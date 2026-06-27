-- Migración v16: tablas que faltaban en el repo (existían solo en Neon).
-- accesos_acta + log_acceso_acta (sistema de acta con QR+PIN) y entregables
-- (checklist del proyecto). Reconstruidas desde el uso real del código.
-- Todo con IF NOT EXISTS: en producción es un no-op (no toca los datos existentes);
-- en una BD nueva deja el sistema completo y reconstruible.

-- ── Acceso seguro al acta: token (QR) + PIN cifrado, con bloqueo por intentos ──
CREATE TABLE IF NOT EXISTS accesos_acta (
  id                 SERIAL PRIMARY KEY,
  cliente_id         INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  documento_id       INTEGER,                       -- documento (acta) asociado, opcional
  token              TEXT NOT NULL UNIQUE,          -- va en la URL del QR
  pin_cifrado        TEXT NOT NULL,                 -- PIN de 5 dígitos (cifrado, ver _crypto.js)
  codigo_aceptacion  TEXT,                          -- ACT-AAAA-CLNNNN-XXXXX
  intentos_fallidos  INTEGER DEFAULT 0,
  bloqueado_hasta    TIMESTAMPTZ,                   -- bloqueo 1h tras 3 fallos
  visitas            INTEGER DEFAULT 0,
  ultimo_acceso      TIMESTAMPTZ,
  email_enviado      BOOLEAN DEFAULT FALSE,
  fecha_envio_email  TIMESTAMPTZ,
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMP DEFAULT NOW(),
  actualizado_en     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accesos_acta_token ON accesos_acta(token);
CREATE INDEX IF NOT EXISTS idx_accesos_acta_cliente ON accesos_acta(cliente_id);

-- ── Auditoría de accesos al acta (IP + user agent + éxito/fallo) ──────────────
CREATE TABLE IF NOT EXISTS log_acceso_acta (
  id              SERIAL PRIMARY KEY,
  acceso_acta_id  INTEGER NOT NULL REFERENCES accesos_acta(id) ON DELETE CASCADE,
  ip              TEXT DEFAULT '',
  user_agent      TEXT DEFAULT '',
  exitoso         BOOLEAN DEFAULT FALSE,
  creado_en       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_acceso_acta ON log_acceso_acta(acceso_acta_id);

-- ── Entregables del proyecto (checklist; pesa 30% del avance si hay fases) ────
CREATE TABLE IF NOT EXISTS entregables (
  id                SERIAL PRIMARY KEY,
  cliente_id        INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  categoria         TEXT DEFAULT 'General',
  completado        BOOLEAN DEFAULT FALSE,
  fecha_completado  TIMESTAMPTZ,
  orden             INTEGER DEFAULT 0,
  notas             TEXT DEFAULT '',
  creado_en         TIMESTAMP DEFAULT NOW(),
  actualizado_en    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entregables_cliente ON entregables(cliente_id);
