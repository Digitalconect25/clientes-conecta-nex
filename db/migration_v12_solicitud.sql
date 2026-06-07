-- Migracion v12 - Formulario publico de solicitud (origen + servicios pedidos)
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'frio';      -- frio | formulario | anuncio
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS servicios_json JSONB DEFAULT '[]'::jsonb;
