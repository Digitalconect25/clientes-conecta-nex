-- Migracion v13 - Seguridad de endpoints publicos
-- Rate limiting generico por IP + evitar doble reserva de cita.
CREATE TABLE IF NOT EXISTS peticiones_publicas (
  id SERIAL PRIMARY KEY,
  ip TEXT,
  ruta TEXT,
  cuando TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peticiones_ip ON peticiones_publicas (ip, ruta, cuando);
-- Una franja (fecha+hora) no se puede reservar dos veces (salvo canceladas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_citas_franja ON citas (fecha, hora) WHERE estado != 'cancelada';
