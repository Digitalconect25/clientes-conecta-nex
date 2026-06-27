-- Migración v18: FIRMA REMOTA del contrato con evidencia.
-- Hoy la "firma" es un dibujo capturado en el panel de la agencia (sin valor).
-- Esto permite enviar el documento al cliente para que lo firme ÉL mismo desde
-- un enlace propio (token), registrando evidencia: fecha de SERVIDOR, IP,
-- user-agent, nombre tecleado y HASH del contenido firmado (integridad).
-- (Las columnas firmado + fecha_firma ya existen y se reutilizan.)
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_token TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_estado TEXT DEFAULT 'borrador';  -- borrador|enviado|visto|firmado|rechazado
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_email TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_nombre TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_ip TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_user_agent TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_hash TEXT DEFAULT '';            -- sha256 del contenido_html al firmar
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_enviada_en TIMESTAMPTZ;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_vista_en TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_firma_token ON documentos(firma_token) WHERE firma_token IS NOT NULL;
