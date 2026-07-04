-- ==================================================================
-- MIGRACION v19 - Agente de captacion diaria + evolucion del lead
-- ==================================================================
-- 1) captacion_config: configuracion del scrapeo diario (ciudad,
--    nichos que rota dia a dia, limite y si esta activo).
-- 2) prospectos.etapa: evolucion del prospecto en el embudo
--    (frio -> contactado -> seguimiento -> interesado -> caliente -> cliente).
-- 3) prospectos_eventos: historial de la evolucion de cada prospecto
--    (alta por scrapeo, emails, interes, respuestas, cambios de etapa).
-- Copia y pega en el SQL Editor de Neon. Es idempotente.
-- La API tambien auto-migra estas tablas al primer uso.
-- ==================================================================

CREATE TABLE IF NOT EXISTS captacion_config (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  activo           BOOLEAN DEFAULT FALSE,       -- si el agente scrapea cada dia
  ciudad           TEXT DEFAULT '',             -- ciudad objetivo del scrapeo
  nichos           TEXT DEFAULT '',             -- nichos separados por comas (rotan a diario)
  limite_diario    INTEGER DEFAULT 10,          -- negocios nuevos por dia (max 20)
  nicho_idx        INTEGER DEFAULT 0,           -- puntero de rotacion del nicho
  ultima_ejecucion TIMESTAMPTZ,
  ultimo_resultado TEXT DEFAULT '',
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO captacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interes_en timestamptz;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa text;        -- frio | contactado | seguimiento | interesado | caliente | cliente | descartado
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa_en timestamptz;

CREATE TABLE IF NOT EXISTS prospectos_eventos (
  id           SERIAL PRIMARY KEY,
  prospecto_id INTEGER,
  tipo         TEXT DEFAULT '',    -- alta | email | seguimiento | interes | respuesta | etapa | convertido
  detalle      TEXT DEFAULT '',
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peventos_pid ON prospectos_eventos (prospecto_id, creado_en DESC);
