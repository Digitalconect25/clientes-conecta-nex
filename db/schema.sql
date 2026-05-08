-- ==================================================================
-- CLIENTES CONECTA NEX - Esquema completo de base de datos
-- ==================================================================
-- Para empezar de cero: copia y pega TODO en el SQL Editor de Neon.
-- Si ya tienes datos, NO uses este archivo, usa db/migration_v2.sql
-- que solo anade lo nuevo sin tocar lo existente.
-- ==================================================================

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
  estado_proyecto TEXT DEFAULT 'Sin iniciar',
  porcentaje_avance INTEGER DEFAULT 0,
  fecha_inicio DATE,
  fecha_fin_prevista DATE,
  fecha_fin_real DATE,
  notas_proyecto TEXT DEFAULT '',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_creado ON clientes(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_estado_proyecto ON clientes(estado_proyecto);

CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  contenido_html TEXT,
  firmado BOOLEAN DEFAULT FALSE,
  fecha_firma TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);

CREATE TABLE IF NOT EXISTS archivos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamano INTEGER NOT NULL,
  contenido BYTEA,
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archivos_cliente ON archivos(cliente_id);

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

CREATE TABLE IF NOT EXISTS contadores (
  clave TEXT PRIMARY KEY,
  valor INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intentos_login (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  exitoso BOOLEAN DEFAULT FALSE,
  cuando TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intentos_ip_cuando ON intentos_login(ip, cuando DESC);
