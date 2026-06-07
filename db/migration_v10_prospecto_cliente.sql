-- ==================================================================
-- MIGRACION v10 - Prospecto convertido en cliente
-- ==================================================================
-- Enlaza un prospecto de captacion en frio con el cliente creado a
-- partir de el (cuando responde y se convierte). Idempotente.
-- ==================================================================

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS cliente_id INTEGER;
