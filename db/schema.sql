-- ==================================================================
-- CLIENTES CONECTA NEX · Esquema completo de base de datos
-- ==================================================================
-- Este archivo es el esquema COMPLETO y al día: las 24 tablas que usa
-- la plataforma, con las columnas que fueron añadiendo las migraciones
-- v2 a v22 ya integradas.
--
-- Cómo usarlo: copia y pega TODO en el SQL Editor de Neon y pulsa Run.
--
-- Es idempotente y seguro sobre una base con datos: todo va con
-- IF NOT EXISTS y no hay ni un DROP. Sobre una base que ya existe crea
-- lo que falte, y el bloque final (PUESTA AL DÍA) añade las columnas
-- nuevas a las tablas que ya estaban creadas, que es justo lo que un
-- CREATE TABLE IF NOT EXISTS no puede hacer por sí solo.
--
-- Las plantillas de email iniciales no están aquí (son datos, no
-- estructura): si las quieres, ejecuta después db/migration_v4.sql.
--
-- Al añadir una tabla nueva: crea su migración db/migration_vNN_*.sql
-- Y refléjala también aquí. Si no, este archivo vuelve a quedarse atrás.
-- ==================================================================


-- ══════════════════════════════════════════════════════════════════
-- 1 · AGENCIA Y CATÁLOGO
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS emisor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nombre TEXT NOT NULL DEFAULT 'Lazaro Carrazana Fandino',
  nif TEXT DEFAULT '',
  nombre_comercial TEXT DEFAULT 'Conecta Nex - Servicios Digital Conect',
  epigrafe TEXT DEFAULT '',
  direccion TEXT DEFAULT 'Calle Alberola 24, Local Bajo',
  cp TEXT DEFAULT '03007',
  ciudad TEXT DEFAULT 'Alicante',
  provincia TEXT DEFAULT 'Alicante',
  email TEXT DEFAULT 'info.digitalconect@gmail.com',
  telefono TEXT DEFAULT '611 986 107',
  web TEXT DEFAULT 'conectanex.com',
  iban TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  color_principal TEXT DEFAULT '#047857',   -- v4: branding de los emails
  firma_email TEXT DEFAULT '',              -- v4
  CONSTRAINT emisor_singleton CHECK (id = 1)
);
INSERT INTO emisor (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS servicios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  descripcion TEXT DEFAULT '',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contadores (
  clave TEXT PRIMARY KEY,
  valor INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMP DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════
-- 2 · CLIENTES Y SU PROYECTO
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  numero_cliente TEXT UNIQUE NOT NULL,
  numero_contrato TEXT UNIQUE,
  estado TEXT DEFAULT 'Pendiente firma',
  tipo_persona TEXT DEFAULT 'Fisica',
  nombre TEXT NOT NULL,
  nif TEXT NOT NULL,
  contacto TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  cp TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  provincia TEXT DEFAULT 'Alicante',
  pais TEXT DEFAULT 'Espana',
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  servicios_json JSONB DEFAULT '[]'::jsonb,
  descripcion TEXT DEFAULT '',
  plazo TEXT DEFAULT '',
  forma_pago TEXT DEFAULT '50% al inicio, 50% a la entrega',
  iva NUMERIC(5,2) DEFAULT 21,
  base_imponible NUMERIC(10,2) DEFAULT 0,
  iva_importe NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  notas TEXT DEFAULT '',
  firma_cliente TEXT DEFAULT '',
  fecha_firma TIMESTAMP,
  estado_proyecto TEXT DEFAULT 'Sin iniciar',   -- v2
  porcentaje_avance INTEGER DEFAULT 0,          -- v2
  fecha_inicio DATE,                            -- v2
  fecha_fin_prevista DATE,                      -- v2
  fecha_fin_real DATE,                          -- v2
  notas_proyecto TEXT DEFAULT '',               -- v2
  branding_json JSONB DEFAULT '{}'::jsonb,      -- v8: colores/tipografías/tagline
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_creado ON clientes(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_estado_proyecto ON clientes(estado_proyecto);

-- Documentos legales (hoja de encargo, cesión de derechos, contrato, acta).
-- Las columnas de firma remota (v18) guardan la evidencia: fecha de SERVIDOR,
-- IP, user-agent, nombre tecleado y hash del contenido firmado.
CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  contenido_html TEXT,
  firmado BOOLEAN DEFAULT FALSE,
  fecha_firma TIMESTAMP,
  firma_token TEXT,                                  -- v18: enlace propio del firmante
  firma_estado TEXT DEFAULT 'borrador',              -- v18: borrador|enviado|visto|firmado|rechazado
  firmante_email TEXT DEFAULT '',                    -- v18
  firmante_nombre TEXT DEFAULT '',                   -- v18
  firmante_ip TEXT DEFAULT '',                       -- v18
  firmante_user_agent TEXT DEFAULT '',               -- v18
  firma_hash TEXT DEFAULT '',                        -- v18: sha256 del html al firmar
  firma_enviada_en TIMESTAMPTZ,                      -- v18
  firma_vista_en TIMESTAMPTZ,                        -- v18
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_firma_token
  ON documentos(firma_token) WHERE firma_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS archivos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamano INTEGER NOT NULL,
  contenido BYTEA,
  incluir_en_acta BOOLEAN DEFAULT FALSE,   -- v8: se embebe en el PDF del acta
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archivos_cliente ON archivos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_archivos_incluir_acta
  ON archivos(cliente_id, incluir_en_acta) WHERE incluir_en_acta = TRUE;

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  importe NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_esperada DATE,
  fecha_pago DATE,
  metodo TEXT DEFAULT 'Transferencia',
  estado TEXT DEFAULT 'Pendiente',
  es_recurrente BOOLEAN DEFAULT FALSE,
  mes_recurrencia TEXT,
  notas TEXT DEFAULT '',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

CREATE TABLE IF NOT EXISTS fases (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  peso INTEGER NOT NULL DEFAULT 10,
  fecha_prevista_inicio DATE,
  fecha_prevista_fin DATE,
  fecha_real_inicio DATE,
  fecha_real_fin DATE,
  notas TEXT DEFAULT '',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW(),
  CONSTRAINT estado_fase_valido CHECK (estado IN ('Pendiente', 'En curso', 'Bloqueada', 'Completada'))
);
CREATE INDEX IF NOT EXISTS idx_fases_cliente ON fases(cliente_id);

-- Entregables: checklist del proyecto (pesa un 30% del avance si hay fases).
CREATE TABLE IF NOT EXISTS entregables (
  id                SERIAL PRIMARY KEY,
  cliente_id        INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  categoria         TEXT DEFAULT 'General',
  completado        BOOLEAN DEFAULT FALSE,
  fecha_completado  TIMESTAMPTZ,
  orden             INTEGER DEFAULT 0,
  notas             TEXT DEFAULT '',
  creado_en         TIMESTAMP DEFAULT NOW(),
  actualizado_en    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entregables_cliente ON entregables(cliente_id);

-- Contraseñas y accesos del cliente (la contraseña va cifrada, ver api/_crypto.js).
CREATE TABLE IF NOT EXISTS accesos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  etiqueta TEXT NOT NULL,
  url TEXT DEFAULT '',
  usuario TEXT DEFAULT '',
  password_cifrado TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  importante BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accesos_cliente ON accesos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_accesos_categoria ON accesos(categoria);


-- ══════════════════════════════════════════════════════════════════
-- 3 · ACTA DE ENTREGA CON QR + PIN  (v16)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accesos_acta (
  id                 SERIAL PRIMARY KEY,
  cliente_id         INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  documento_id       INTEGER,                       -- acta asociada, opcional
  token              TEXT NOT NULL UNIQUE,          -- va en la URL del QR
  pin_cifrado        TEXT NOT NULL,                 -- PIN de 5 dígitos, cifrado
  codigo_aceptacion  TEXT,                          -- ACT-AAAA-CLNNNN-XXXXX
  intentos_fallidos  INTEGER DEFAULT 0,
  bloqueado_hasta    TIMESTAMPTZ,                   -- bloqueo de 1h tras 3 fallos
  visitas            INTEGER DEFAULT 0,
  ultimo_acceso      TIMESTAMPTZ,
  email_enviado      BOOLEAN DEFAULT FALSE,
  fecha_envio_email  TIMESTAMPTZ,
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMP DEFAULT NOW(),
  actualizado_en     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accesos_acta_token ON accesos_acta(token);
CREATE INDEX IF NOT EXISTS idx_accesos_acta_cliente ON accesos_acta(cliente_id);

CREATE TABLE IF NOT EXISTS log_acceso_acta (
  id              SERIAL PRIMARY KEY,
  acceso_acta_id  INTEGER NOT NULL REFERENCES accesos_acta(id) ON DELETE CASCADE,
  ip              TEXT DEFAULT '',
  user_agent      TEXT DEFAULT '',
  exitoso         BOOLEAN DEFAULT FALSE,
  creado_en       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_acceso_acta ON log_acceso_acta(acceso_acta_id);


-- ══════════════════════════════════════════════════════════════════
-- 4 · CAPTACIÓN: PROSPECTOS, EMBUDO Y AGENDA
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prospectos (
  id SERIAL PRIMARY KEY,
  empresa TEXT DEFAULT '',
  nombre TEXT DEFAULT '',              -- persona de contacto, si se conoce
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  website TEXT DEFAULT '',             -- vacío = sin presencia
  situacion TEXT DEFAULT 'sin_presencia',  -- sin_presencia | mejorable
  observaciones TEXT DEFAULT '',
  asunto TEXT DEFAULT '',              -- asunto del email (IA o editado)
  email_borrador TEXT DEFAULT '',      -- cuerpo HTML del email
  estado TEXT DEFAULT 'nuevo',         -- nuevo | email_enviado | respondido | convertido | descartado
  cliente_id INTEGER,                  -- v10: cliente creado a partir de él
  origen TEXT DEFAULT 'frio',          -- v12: frio | formulario | anuncio
  servicios_json JSONB DEFAULT '[]'::jsonb,  -- v12: servicios que pidió
  interes_en TIMESTAMPTZ,              -- v19
  etapa TEXT,                          -- v19: frio|contactado|seguimiento|interesado|caliente|cliente|descartado
  etapa_en TIMESTAMPTZ,                -- v19
  enviado_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospectos_creado ON prospectos (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos (estado);

-- Historial de la evolución de cada prospecto (v19).
CREATE TABLE IF NOT EXISTS prospectos_eventos (
  id           SERIAL PRIMARY KEY,
  prospecto_id INTEGER,
  tipo         TEXT DEFAULT '',    -- alta | email | seguimiento | interes | respuesta | etapa | convertido
  detalle      TEXT DEFAULT '',
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peventos_pid ON prospectos_eventos (prospecto_id, creado_en DESC);

-- Configuración del agente de captación diaria (v19). Fila única.
CREATE TABLE IF NOT EXISTS captacion_config (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  activo           BOOLEAN DEFAULT FALSE,   -- si scrapea cada día
  ciudad           TEXT DEFAULT '',
  nichos           TEXT DEFAULT '',         -- separados por comas, rotan a diario
  limite_diario    INTEGER DEFAULT 10,      -- negocios nuevos por día (máx. 20)
  nicho_idx        INTEGER DEFAULT 0,       -- puntero de rotación
  ultima_ejecucion TIMESTAMPTZ,
  ultimo_resultado TEXT DEFAULT '',
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO captacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Citas que reserva el prospecto desde el botón "Agendar cita" del email (v11).
CREATE TABLE IF NOT EXISTS citas (
  id           SERIAL PRIMARY KEY,
  prospecto_id INTEGER,
  cliente_id   INTEGER,
  nombre       TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  telefono     TEXT DEFAULT '',
  fecha        DATE NOT NULL,
  hora         TEXT NOT NULL,
  nota         TEXT DEFAULT '',
  estado       TEXT DEFAULT 'pendiente',  -- pendiente | confirmada | hecha | cancelada
  origen       TEXT DEFAULT 'frio',       -- frio | cliente | manual
  creado_en    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas (fecha, hora);
-- Una franja no se puede reservar dos veces, salvo que esté cancelada (v13).
CREATE UNIQUE INDEX IF NOT EXISTS uq_citas_franja
  ON citas (fecha, hora) WHERE estado != 'cancelada';


-- ══════════════════════════════════════════════════════════════════
-- 5 · DISEÑO DE LA OFERTA Y PROPUESTA COMERCIAL
-- ══════════════════════════════════════════════════════════════════

-- v21 · Lo que se prepara ANTES de mandar la propuesta: qué agente de IA se le
-- va a montar (brief por sector), qué elementos entran con su precio y su
-- puntuación, cómo se reparten entre puerta de entrada y ticket alto, y a qué
-- tipos de cliente va dirigido. De aquí bebe api/propuestas.js para redactar.
CREATE TABLE IF NOT EXISTS diseno_oferta (
  id SERIAL PRIMARY KEY,
  prospecto_id INTEGER UNIQUE,
  cliente_id INTEGER,

  nicho TEXT DEFAULT '',
  brief_comun JSONB DEFAULT '{}'::jsonb,   -- respuestas a las preguntas de siempre
  brief_nicho JSONB DEFAULT '{}'::jsonb,   -- respuestas propias del sector

  -- [{id,nombre,precio,precio_oferta,descuento_max,plazos:{numero,monto},
  --   columna:'sin-asignar'|'front'|'back', best_seller,
  --   puntos:{complementa,objecion,valor,esfuerzo}}]
  items_json JSONB DEFAULT '[]'::jsonb,

  -- [{id,nombre,dolor_corto,x,y,dolor,sueno,no,si}]
  avatares_json JSONB DEFAULT '[]'::jsonb,

  -- v23 · Ficha del cliente y lo que arma la propuesta imprimible: contacto,
  -- telefono, email, nif, localidad, origen, estado, aceptadaEl, validaHasta,
  -- notas, condiciones, siguientePaso, enlacePago, conceptoPago.
  ficha_json JSONB DEFAULT '{}'::jsonb,

  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diseno_prospecto ON diseno_oferta (prospecto_id);
CREATE INDEX IF NOT EXISTS idx_diseno_cliente ON diseno_oferta (cliente_id);

-- v17 · El eslabón entre "lead interesado" y "cliente": una oferta con precio
-- que el lead VE y ACEPTA por un enlace propio, con valor probatorio (fecha de
-- servidor, IP, user-agent y nombre tecleado), no un dibujo.
CREATE TABLE IF NOT EXISTS propuestas (
  id                  SERIAL PRIMARY KEY,
  prospecto_id        INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
  cliente_id          INTEGER,
  numero              TEXT,                          -- PROP-AAAA-NNNN
  titulo              TEXT DEFAULT 'Propuesta de servicios',
  intro               TEXT DEFAULT '',
  items_json          JSONB DEFAULT '[]'::jsonb,     -- [{nombre,descripcion,cantidad,precio,subtotal,servicio_id}]
  descuento           NUMERIC(10,2) DEFAULT 0,
  total               NUMERIC(10,2) DEFAULT 0,
  notas               TEXT DEFAULT '',               -- condiciones / forma de pago / plazo
  validez_dias        INTEGER DEFAULT 15,
  estado              TEXT DEFAULT 'borrador',       -- borrador|enviada|vista|aceptada|rechazada|caducada
  token               TEXT UNIQUE,                   -- enlace público /propuesta/:token
  destinatario_email  TEXT DEFAULT '',
  destinatario_nombre TEXT DEFAULT '',
  enviada_en          TIMESTAMPTZ,
  vista_en            TIMESTAMPTZ,
  aceptada_en         TIMESTAMPTZ,                   -- sello de SERVIDOR
  acept_nombre        TEXT DEFAULT '',
  acept_ip            TEXT DEFAULT '',
  acept_user_agent    TEXT DEFAULT '',
  rechazada_en        TIMESTAMPTZ,
  creado_en           TIMESTAMP DEFAULT NOW(),
  actualizado_en      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_propuestas_prospecto ON propuestas(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_propuestas_token ON propuestas(token);
CREATE INDEX IF NOT EXISTS idx_propuestas_estado ON propuestas(estado);


-- ══════════════════════════════════════════════════════════════════
-- 6 · FICHAS DE IMPLEMENTACIÓN DEL AGENTE IA  (v22)
-- ══════════════════════════════════════════════════════════════════

-- Ficha de descubrimiento del agente de WhatsApp: se manda al cliente por un
-- enlace privado, la rellena por secciones con borrador, la firma (canvas + OTP
-- + hash de evidencia, igual que los contratos) y la agencia valida con un
-- segundo código. api/fichas.js también crea esta tabla sola al primer uso.
CREATE TABLE IF NOT EXISTS fichas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Ficha de implementacion del agente IA WhatsApp',
  version INTEGER NOT NULL DEFAULT 1,
  secciones JSONB NOT NULL DEFAULT '[]',
  contenido JSONB NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'borrador',

  -- Enlace privado de cumplimentación (sin login).
  token TEXT UNIQUE,
  destinatario_email TEXT DEFAULT '',
  destinatario_nombre TEXT DEFAULT '',
  enviada_en TIMESTAMPTZ,
  vista_en TIMESTAMPTZ,
  completada_en TIMESTAMPTZ,

  -- Ficha ya renderizada (tras firmar), para email/PDF/consulta.
  contenido_html TEXT,

  -- Firma electrónica del cliente (evidencia, igual que documentos.*).
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

  -- Doble validación (la agencia confirma con código por email).
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


-- ══════════════════════════════════════════════════════════════════
-- 7 · EMAIL: PLANTILLAS, ENVIADOS Y BANDEJA
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_plantillas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  asunto TEXT NOT NULL,
  cuerpo_html TEXT NOT NULL,
  categoria TEXT DEFAULT 'General',
  activa BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_plantillas_categoria ON email_plantillas(categoria);

CREATE TABLE IF NOT EXISTS emails_enviados (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  plantilla_id INTEGER REFERENCES email_plantillas(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL,
  cc TEXT DEFAULT '',
  asunto TEXT NOT NULL,
  cuerpo_html TEXT,
  archivos_adjuntos JSONB DEFAULT '[]'::jsonb,
  exitoso BOOLEAN DEFAULT FALSE,
  resend_id TEXT,
  error TEXT,
  enviado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emails_enviados_cliente ON emails_enviados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_emails_enviados_fecha ON emails_enviados(enviado_en DESC);

-- Bandeja de entrada: respuestas a los emails (v14).
CREATE TABLE IF NOT EXISTS mensajes_recibidos (
  id           SERIAL PRIMARY KEY,
  de           TEXT,
  para         TEXT,
  asunto       TEXT,
  texto        TEXT,
  html         TEXT,
  prospecto_id INTEGER,
  cliente_id   INTEGER,
  email_id     TEXT,                    -- v15: id de Resend, para traer el cuerpo después
  leido        BOOLEAN DEFAULT FALSE,
  recibido_en  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_recibido ON mensajes_recibidos (recibido_en DESC);


-- ══════════════════════════════════════════════════════════════════
-- 8 · SEGURIDAD
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intentos_login (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  exitoso BOOLEAN DEFAULT FALSE,
  cuando TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intentos_ip_cuando ON intentos_login(ip, cuando DESC);

-- Rate limiting genérico por IP de los endpoints públicos (v13).
CREATE TABLE IF NOT EXISTS peticiones_publicas (
  id SERIAL PRIMARY KEY,
  ip TEXT,
  ruta TEXT,
  cuando TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peticiones_ip ON peticiones_publicas (ip, ruta, cuando);


-- ══════════════════════════════════════════════════════════════════
-- 9 · PUESTA AL DÍA DE UNA BASE QUE YA EXISTÍA
-- ══════════════════════════════════════════════════════════════════
-- Sobre una base que ya tiene las tablas, los CREATE de arriba no hacen nada
-- (IF NOT EXISTS), así que las columnas nuevas no llegarían. Estos ALTER sí.
-- En una base recién creada son un no-op: las columnas ya están puestas.

ALTER TABLE emisor    ADD COLUMN IF NOT EXISTS color_principal TEXT DEFAULT '#047857';
ALTER TABLE emisor    ADD COLUMN IF NOT EXISTS firma_email TEXT DEFAULT '';

ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS estado_proyecto TEXT DEFAULT 'Sin iniciar';
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS porcentaje_avance INTEGER DEFAULT 0;
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS fecha_fin_prevista DATE;
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS fecha_fin_real DATE;
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS notas_proyecto TEXT DEFAULT '';
ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE archivos  ADD COLUMN IF NOT EXISTS incluir_en_acta BOOLEAN DEFAULT FALSE;

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_token TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_estado TEXT DEFAULT 'borrador';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_email TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_nombre TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_ip TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_user_agent TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_hash TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_enviada_en TIMESTAMPTZ;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_vista_en TIMESTAMPTZ;

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS cliente_id INTEGER;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'frio';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS servicios_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interes_en TIMESTAMPTZ;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa TEXT;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa_en TIMESTAMPTZ;

ALTER TABLE mensajes_recibidos ADD COLUMN IF NOT EXISTS email_id TEXT;

-- ==================================================================
-- Listo. 24 tablas. Si quieres además las plantillas de email de
-- partida, ejecuta después db/migration_v4.sql (son datos, no estructura).
-- ==================================================================
