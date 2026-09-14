-- Migracion v24 - Cuanto DOLOR tiene cada lead
--
-- El scrapeo traia negocios sin distinguir a quien le hace falta de verdad lo
-- que vendemos. Un negocio con web decente, bien posicionado y con su ficha de
-- Google al dia no va a contratar nada; el que no aparece en ningun sitio, si.
--
-- `dolor` es una puntuacion de 0 a 100 calculada con senales OBJETIVAS, no con
-- opiniones de la IA: sin web (+45), solo una red social (+30), web de
-- plantilla gratuita (+22), la web no responde (+25), no sale en la ficha local
-- de Google (+20), sin telefono (+12), autonomo (+8).
--
-- Sirve para ordenar la lista por quien mas nos necesita y para que el agente
-- diario solo se traiga a esos.
--
-- Solo anade una columna. api/prospectos.js tambien la crea sola con
-- ALTER TABLE IF NOT EXISTS por si el deploy llega antes de pegar este SQL.

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS dolor INTEGER;
CREATE INDEX IF NOT EXISTS idx_prospectos_dolor ON prospectos (dolor DESC NULLS LAST);
