-- v15: guarda el id del email recibido (Resend) para poder traer el cuerpo
-- despues (la cuenta de recepcion usa RESEND_RECEIVING_API_KEY).
-- Esta columna ya se anadio en produccion con un ALTER manual; este archivo la
-- deja registrada para que la base de datos sea reproducible desde las migraciones.
ALTER TABLE mensajes_recibidos ADD COLUMN IF NOT EXISTS email_id TEXT;
