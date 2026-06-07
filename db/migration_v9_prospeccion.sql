-- ==================================================================
-- MIGRACION v9 - Captacion en frio (prospeccion)
-- ==================================================================
-- Anade la tabla de prospectos para la captacion en frio: negocios
-- scrapeados sin presencia (o mejorable) a los que enviar un email.
-- Copia y pega en el SQL Editor de Neon. Es idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS prospectos (
  id             SERIAL PRIMARY KEY,
  empresa        TEXT DEFAULT '',
  nombre         TEXT DEFAULT '',            -- persona de contacto (si se conoce)
  email          TEXT DEFAULT '',
  telefono       TEXT DEFAULT '',
  sector         TEXT DEFAULT '',
  ciudad         TEXT DEFAULT '',
  website        TEXT DEFAULT '',            -- vacio = sin presencia
  situacion      TEXT DEFAULT 'sin_presencia', -- sin_presencia | mejorable
  observaciones  TEXT DEFAULT '',
  asunto         TEXT DEFAULT '',            -- asunto del email (IA o editado)
  email_borrador TEXT DEFAULT '',            -- cuerpo HTML del email
  estado         TEXT DEFAULT 'nuevo',       -- nuevo | email_enviado | respondido | convertido | descartado
  enviado_en     TIMESTAMP,
  creado_en      TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_creado ON prospectos (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos (estado);
