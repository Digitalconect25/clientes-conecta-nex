-- ==================================================================
-- MIGRACION v11 - Agenda de citas
-- ==================================================================
-- Citas que reserva el prospecto/cliente desde el boton "Agendar cita"
-- del email. Se reflejan en el panel de la agencia (seccion Agenda).
-- Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS citas (
  id           SERIAL PRIMARY KEY,
  prospecto_id INTEGER,
  cliente_id   INTEGER,
  nombre       TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  telefono     TEXT DEFAULT '',
  fecha        DATE NOT NULL,
  hora         TEXT NOT NULL,
  nota         TEXT DEFAULT '',
  estado       TEXT DEFAULT 'pendiente',  -- pendiente | confirmada | hecha | cancelada
  origen       TEXT DEFAULT 'frio',       -- frio | cliente | manual
  creado_en    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas (fecha, hora);
