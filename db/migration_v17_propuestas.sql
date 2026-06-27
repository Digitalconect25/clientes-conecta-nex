-- Migración v17: PROPUESTAS comerciales con aceptación + evidencia.
-- El eslabón que faltaba entre "lead interesado/cita" y "cliente": una oferta
-- de servicios con precio que se envía al lead, que él VE y ACEPTA por un enlace
-- propio (token), quedando registrada la aceptación con fecha de servidor, IP,
-- user-agent y nombre tecleado (aceptación con valor probatorio, no un dibujo).
CREATE TABLE IF NOT EXISTS propuestas (
  id                  SERIAL PRIMARY KEY,
  prospecto_id        INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
  cliente_id          INTEGER,
  numero              TEXT,                          -- PROP-AAAA-NNNN
  titulo              TEXT DEFAULT 'Propuesta de servicios',
  intro               TEXT DEFAULT '',               -- texto introductorio (IA o editado)
  items_json          JSONB DEFAULT '[]'::jsonb,     -- [{nombre, descripcion, cantidad, precio, subtotal, servicio_id}]
  descuento           NUMERIC(10,2) DEFAULT 0,
  total               NUMERIC(10,2) DEFAULT 0,
  notas               TEXT DEFAULT '',               -- condiciones / forma de pago / plazo
  validez_dias        INTEGER DEFAULT 15,
  estado              TEXT DEFAULT 'borrador',       -- borrador|enviada|vista|aceptada|rechazada|caducada
  token               TEXT UNIQUE,                   -- enlace público /propuesta/:token
  destinatario_email  TEXT DEFAULT '',
  destinatario_nombre TEXT DEFAULT '',
  enviada_en          TIMESTAMPTZ,
  vista_en            TIMESTAMPTZ,
  aceptada_en         TIMESTAMPTZ,                    -- sello de SERVIDOR
  acept_nombre        TEXT DEFAULT '',               -- nombre tecleado por quien acepta
  acept_ip            TEXT DEFAULT '',
  acept_user_agent    TEXT DEFAULT '',
  rechazada_en        TIMESTAMPTZ,
  creado_en           TIMESTAMP DEFAULT NOW(),
  actualizado_en      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_propuestas_prospecto ON propuestas(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_propuestas_token ON propuestas(token);
CREATE INDEX IF NOT EXISTS idx_propuestas_estado ON propuestas(estado);
