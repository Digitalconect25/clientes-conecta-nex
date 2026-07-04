-- ==================================================================
-- MIGRACION v20 - Contenido SEO (blog en WordPress)
-- ==================================================================
-- El agente genera articulos SEO orientados a captar negocios locales
-- y los publica en la web (conectanex.com) via Royal MCP.
--   - contenidos: cada articulo (borrador -> publicado en WordPress).
--   - contenido_config: piloto automatico (temas que rotan, frecuencia, activo).
-- Idempotente. La API tambien auto-migra al primer uso.
-- ==================================================================

CREATE TABLE IF NOT EXISTS contenidos (
  id             SERIAL PRIMARY KEY,
  tema           TEXT DEFAULT '',            -- keyword/tema del articulo
  titulo         TEXT DEFAULT '',
  slug           TEXT DEFAULT '',
  meta_desc      TEXT DEFAULT '',            -- meta description SEO
  cuerpo_html    TEXT DEFAULT '',            -- articulo en HTML
  etiquetas      TEXT DEFAULT '',            -- tags separados por comas
  estado         TEXT DEFAULT 'borrador',    -- borrador | publicado | error
  wp_post_id     INTEGER,                    -- id de la entrada en WordPress
  wp_url         TEXT DEFAULT '',            -- URL publica del articulo
  error          TEXT DEFAULT '',
  origen         TEXT DEFAULT 'manual',      -- manual | agente
  creado_en      TIMESTAMPTZ DEFAULT NOW(),
  publicado_en   TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contenidos_estado ON contenidos (estado, creado_en DESC);

CREATE TABLE IF NOT EXISTS contenido_config (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  activo           BOOLEAN DEFAULT FALSE,     -- publica solo cada semana
  temas            TEXT DEFAULT '',           -- temas/keywords separados por comas (rotan)
  tema_idx         INTEGER DEFAULT 0,
  auto_publicar    BOOLEAN DEFAULT FALSE,     -- true = publica; false = deja borrador para revisar
  ultima_ejecucion TIMESTAMPTZ,
  ultimo_resultado TEXT DEFAULT '',
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO contenido_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
