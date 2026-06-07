-- Migracion v14 - Bandeja de entrada (respuestas a los emails)
CREATE TABLE IF NOT EXISTS mensajes_recibidos (
  id           SERIAL PRIMARY KEY,
  de           TEXT,
  para         TEXT,
  asunto       TEXT,
  texto        TEXT,
  html         TEXT,
  prospecto_id INTEGER,
  cliente_id   INTEGER,
  leido        BOOLEAN DEFAULT FALSE,
  recibido_en  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_recibido ON mensajes_recibidos (recibido_en DESC);
