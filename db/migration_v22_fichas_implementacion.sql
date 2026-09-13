-- Migracion v22 - Modulo "Fichas de implementacion" (ficha de descubrimiento
-- del agente IA de WhatsApp): envio de enlace privado, cumplimentacion por
-- secciones con borrador, firma electronica del cliente (canvas + OTP + hash
-- de evidencia, igual que los contratos) y doble validacion de la agencia.
--
-- Solo anade tabla nueva: no toca clientes/documentos/archivos existentes.
-- El backend (api/fichas.js) tambien crea esta tabla sola con
-- CREATE TABLE IF NOT EXISTS por si el deploy llega antes de pegar este SQL
-- en el editor de Neon.

CREATE TABLE IF NOT EXISTS fichas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Ficha de implementacion del agente IA WhatsApp',
  version INTEGER NOT NULL DEFAULT 1,
  secciones JSONB NOT NULL DEFAULT '[]',
  contenido JSONB NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'borrador',

  -- Enlace privado de cumplimentacion (sin login).
  token TEXT UNIQUE,
  destinatario_email TEXT DEFAULT '',
  destinatario_nombre TEXT DEFAULT '',
  enviada_en TIMESTAMPTZ,
  vista_en TIMESTAMPTZ,
  completada_en TIMESTAMPTZ,

  -- Ficha ya renderizada (tras firmar), para email/PDF/consulta.
  contenido_html TEXT,

  -- Firma electronica del cliente (evidencia, igual que documentos.*).
  firmante_nombre TEXT,
  firmante_nif TEXT,
  firmante_cargo TEXT,
  firmante_email TEXT,
  firma_codigo TEXT,
  firma_codigo_exp TIMESTAMPTZ,
  firma_img TEXT,
  firma_hash TEXT,
  firma_ref TEXT,
  firmante_ip TEXT,
  firmante_user_agent TEXT,
  fecha_firma TIMESTAMPTZ,

  -- Doble validacion (la agencia confirma con codigo por email).
  validacion_token TEXT,
  validacion_codigo TEXT,
  validacion_codigo_exp TIMESTAMPTZ,
  validado_en TIMESTAMPTZ,

  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fichas_cliente ON fichas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fichas_token ON fichas(token);
CREATE INDEX IF NOT EXISTS idx_fichas_validacion_token ON fichas(validacion_token);
CREATE INDEX IF NOT EXISTS idx_fichas_estado ON fichas(estado);
