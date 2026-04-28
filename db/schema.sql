-- ==================================================================
-- CLIENTES CONECTA NEX - Esquema de base de datos
-- ==================================================================
-- Para ejecutar: copia y pega TODO en el SQL Editor de Neon (en tu
-- proyecto "Clientes Conecta Nex" -> SQL Editor) y pulsa "Run".
-- Crea todas las tablas. Si ya existen, las ignora.
-- ==================================================================

-- Datos del emisor (tu, una unica fila)
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

-- Catalogo de servicios
CREATE TABLE IF NOT EXISTS servicios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  descripcion TEXT DEFAULT '',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Clientes
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
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_creado ON clientes(creado_en DESC);

-- Documentos generados (PDFs guardados por cliente)
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

-- Archivos subidos por cliente (logos, briefings, etc.)
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

-- Contadores anuales para numeracion automatica
CREATE TABLE IF NOT EXISTS contadores (
  clave TEXT PRIMARY KEY,
  valor INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Insertar catalogo de 31 servicios
INSERT INTO servicios (nombre, categoria, precio, descripcion) VALUES
('Pack Esencial', 'Webs y landings', 350, 'Web de 1 pagina, formulario, optimizacion movil'),
('Captacion Pro', 'Webs y landings', 450, 'Landing page con Calendly integrado'),
('Web de Producto', 'Webs y landings', 400, 'Web de presentacion de producto o servicio'),
('Web Corporativa', 'Webs y landings', 550, 'Web multi-pagina corporativa (5-7 secciones)'),
('Lanzamiento Local', 'Webs y landings', 700, 'Web + ficha Google + perfiles redes'),
('Logo simple', 'Identidad', 150, 'Logo principal en formatos digitales'),
('Identidad basica', 'Identidad', 300, 'Logo + paleta + tipografias + manual breve'),
('Identidad completa', 'Identidad', 500, 'Identidad basica + papeleria + plantillas redes'),
('Pack 10 posts', 'Diseno Canva', 80, '10 posts disenados para Instagram y Facebook'),
('Flyer o tarjeta', 'Diseno Canva', 60, 'Flyer A5 o tarjeta de visita'),
('Carta menu restaurante', 'Diseno Canva', 80, 'Diseno de carta menu para restaurante'),
('Carteleria', 'Diseno Canva', 80, 'Cartel A3 o A2 para promocion'),
('QR carta digital', 'Codigos QR', 50, 'QR + carta digital para hosteleria'),
('QR WhatsApp', 'Codigos QR', 30, 'QR a WhatsApp con mensaje predefinido'),
('QR resenas Google', 'Codigos QR', 30, 'QR a resenas Google Business'),
('Pack QR restaurante', 'Codigos QR', 100, 'QR carta + WhatsApp + resenas'),
('Optimizacion IG y FB', 'Redes y Google', 200, 'Optimizacion completa de perfiles sociales'),
('Ficha Google Business', 'Redes y Google', 150, 'Alta y optimizacion ficha Google Business'),
('Bot WhatsApp basico', 'Bots', 150, 'Auto-respuestas WhatsApp Business'),
('Bot WhatsApp con IA', 'Bots', 350, 'Bot con IA, +49 EUR/mes mantenimiento'),
('Migracion hosting o dominio', 'Otros', 200, 'Migracion tecnica de hosting o dominio'),
('Configuracion de blog', 'Otros', 150, 'Configuracion de blog en web existente'),
('Pasarela de pago', 'Otros', 150, 'Configuracion Stripe o pasarela equivalente'),
('Plan Mantenimiento', 'Mensual', 49, '49 EUR/mes mantenimiento web'),
('Plan Crecimiento', 'Mensual', 250, '250 EUR/mes mantenimiento + redes'),
('Plan Cliente Activo', 'Mensual', 350, '350 EUR/mes servicio integral'),
('Combo Arranque', 'Combos', 600, 'Logo simple + Pack Esencial'),
('Combo Captacion', 'Combos', 1700, 'Identidad + Captacion Pro + Google + redes'),
('Combo Lanzamiento Total', 'Combos', 1150, 'Identidad basica + web + redes + Google'),
('Combo Marca y Web', 'Combos', 850, 'Identidad completa + Pack Esencial'),
('Servicio personalizado', 'Personalizado', 0, 'A definir segun necesidades')
ON CONFLICT DO NOTHING;
