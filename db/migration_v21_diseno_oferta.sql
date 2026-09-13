-- v21 · Diseño de oferta y brief del agente de IA (por prospecto)
--
-- Lo que se prepara ANTES de mandar la propuesta: qué agente se le va a montar
-- al cliente (brief por sector), qué elementos entran en la oferta con su precio
-- y su puntuación, cómo se reparten entre puerta de entrada y ticket alto, y a
-- qué tipos de cliente va dirigido.
--
-- De aquí bebe la propuesta: api/propuestas.js (generar_ia) lee el brief para
-- redactar el diagnóstico, y api/diseno.js puede volcar los elementos como
-- líneas de la propuesta.
--
-- Idempotente: se puede ejecutar en Neon las veces que haga falta.

CREATE TABLE IF NOT EXISTS diseno_oferta (
  id SERIAL PRIMARY KEY,
  prospecto_id INTEGER UNIQUE,
  cliente_id INTEGER,

  -- Brief del agente
  nicho TEXT DEFAULT '',
  brief_comun JSONB DEFAULT '{}'::jsonb,   -- respuestas a las preguntas de siempre
  brief_nicho JSONB DEFAULT '{}'::jsonb,   -- respuestas propias del sector

  -- Diseño de la oferta: [{id,nombre,precio,precio_oferta,descuento_max,
  --   plazos:{numero,monto}, columna:'sin-asignar'|'front'|'back', best_seller,
  --   puntos:{complementa,objecion,valor,esfuerzo}}]
  items_json JSONB DEFAULT '[]'::jsonb,

  -- Mapa de avatares: [{id,nombre,dolor_corto,x,y,dolor,sueno,no,si}]
  avatares_json JSONB DEFAULT '[]'::jsonb,

  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diseno_prospecto ON diseno_oferta (prospecto_id);
CREATE INDEX IF NOT EXISTS idx_diseno_cliente ON diseno_oferta (cliente_id);
