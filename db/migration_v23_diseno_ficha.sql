-- Migracion v23 - Offer Lab completo: la ficha del cliente y el emisor
--
-- Offer Lab tiene cinco pestanas y solo cuatro cabian en la tabla que habia:
-- faltaba donde guardar la FICHA (persona de contacto, telefono, NIF, estado de
-- la propuesta, hasta cuando vale, notas) y lo que arma la PROPUESTA imprimible
-- (condiciones, siguiente paso, enlace de cobro y su concepto).
--
-- Va todo en una sola columna JSONB en vez de quince columnas sueltas: son
-- campos de un documento, no criterios por los que se filtra ni se ordena, y
-- asi anadir uno manana no pide otra migracion.
--
-- Solo anade una columna. No toca nada de lo que ya hay.
-- api/diseno.js tambien la crea solo con ALTER TABLE IF NOT EXISTS por si el
-- deploy llega antes de pegar este SQL en el editor de Neon.

ALTER TABLE diseno_oferta ADD COLUMN IF NOT EXISTS ficha_json JSONB DEFAULT '{}'::jsonb;
