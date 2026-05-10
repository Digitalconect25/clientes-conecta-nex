-- ==================================================================
-- MIGRACION V8 - Marca y materiales graficos en el Acta de Entrega
-- ==================================================================
-- Para ejecutar: copia y pega TODO en el SQL Editor de Neon, en tu
-- proyecto "Clientes Conecta Nex" -> SQL Editor, y pulsa "Run".
-- Es seguro de ejecutar varias veces (idempotente).
--
-- IMPORTANTE: este bloque solo ANADE columnas a tablas existentes.
-- NO toca ni borra nada existente.
-- ==================================================================

-- 1. Anadir branding_json a clientes
--    Estructura esperada (JSON):
--    {
--      "colores": [{"nombre": "Verde principal", "hex": "#0d3b2e", "uso": "fondos"}],
--      "tipografias": [{"nombre": "Bricolage Grotesque", "uso": "titulos"}],
--      "tagline": "Conecta, Vibra, Vive."
--    }
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{}'::jsonb;

-- 2. Anadir incluir_en_acta a archivos
--    Marca los archivos (logos, imagenes) que el usuario quiere
--    embeber en el PDF del Acta de Entrega.
ALTER TABLE archivos
  ADD COLUMN IF NOT EXISTS incluir_en_acta BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_archivos_incluir_acta
  ON archivos(cliente_id, incluir_en_acta)
  WHERE incluir_en_acta = TRUE;
