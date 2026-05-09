-- ==================================================================
-- MIGRACION V4 - Sistema de Emails
-- ==================================================================
-- Para ejecutar: copia y pega TODO en el SQL Editor de Neon, en tu
-- proyecto "Clientes Conecta Nex" -> SQL Editor, y pulsa "Run".
-- Es seguro de ejecutar varias veces (idempotente).
--
-- IMPORTANTE: Antes de pegar, verifica que el cuadro este vacio.
-- Este SQL NO usa DROP TABLE, solo CREATE/ALTER IF NOT EXISTS.
-- ==================================================================

-- 1. Tabla de plantillas de email
-- Lazaro crea plantillas reutilizables (Bienvenida, Recordatorio pago, etc.)
-- Cada plantilla tiene asunto y cuerpo HTML con variables tipo {{nombre}}.
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

-- 2. Tabla de emails enviados (historial)
-- Cada email enviado queda registrado con fecha, plantilla usada, archivos adjuntos.
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

-- 3. Configuracion del emisor: anadir campos opcionales para branding email
ALTER TABLE emisor ADD COLUMN IF NOT EXISTS color_principal TEXT DEFAULT '#047857';
ALTER TABLE emisor ADD COLUMN IF NOT EXISTS firma_email TEXT DEFAULT '';

-- 4. Plantillas iniciales
INSERT INTO email_plantillas (nombre, descripcion, asunto, cuerpo_html, categoria, orden)
SELECT * FROM (VALUES
  (
    'Bienvenida y solicitud de materiales',
    'Email tras firma de contrato. Pide al cliente los materiales para arrancar.',
    'Bienvenido a Conecta Nex - Empezamos tu proyecto',
    '<p>Hola {{cliente_nombre}},</p><p>Gracias por confiar en Conecta Nex. Ya tenemos firmado el contrato {{numero_contrato}} y estamos listos para empezar tu proyecto.</p><p>Para arrancar necesitamos que nos hagas llegar:</p><ul><li>Logo de tu empresa en alta resolucion (si lo tienes)</li><li>Fotos del local, productos o equipo</li><li>Textos sobre tu negocio (que ofreces, a quien, donde)</li><li>Accesos a redes sociales y Google Business si los tienes</li><li>Cualquier referencia visual que te guste (webs, marcas, estilos)</li></ul><p>Puedes responder a este email con los archivos o subirlos a un Drive y mandarme el enlace.</p><p>Cualquier duda, aqui estoy.</p><p>Un saludo,<br>{{emisor_nombre}}</p>',
    'Inicio',
    1
  ),
  (
    'Recordatorio de pago pendiente',
    'Recordatorio amistoso de pago que vence o esta vencido.',
    'Recordatorio: pago pendiente de tu proyecto {{numero_contrato}}',
    '<p>Hola {{cliente_nombre}},</p><p>Te escribo para recordarte que tienes un pago pendiente de tu proyecto.</p><p>Si ya lo has hecho, ignora este email y mandame el comprobante para registrarlo. Si no, puedes hacer la transferencia con los datos que aparecen en tu hoja de encargo.</p><p>Cualquier duda, respondeme y lo vemos.</p><p>Un saludo,<br>{{emisor_nombre}}<br>{{emisor_telefono}}</p>',
    'Pagos',
    2
  ),
  (
    'Avance del proyecto',
    'Comunicar al cliente que ha avanzado una fase importante.',
    'Avance de tu proyecto - {{cliente_nombre}}',
    '<p>Hola {{cliente_nombre}},</p><p>Te escribo para ponerte al dia sobre el estado de tu proyecto.</p><p>[Cuentale aqui que has hecho esta semana o este sprint, manteniendolo simple]</p><p>El proximo paso sera [explica el siguiente hito o lo que necesitas de el].</p><p>Cualquier duda o si necesitas ver algo en directo, dime y lo vemos.</p><p>Un saludo,<br>{{emisor_nombre}}</p>',
    'Seguimiento',
    3
  ),
  (
    'Entrega del proyecto',
    'Email para enviar el acta de entrega final con el PDF adjunto.',
    'Tu proyecto esta listo - Acta de entrega adjunta',
    '<p>Hola {{cliente_nombre}},</p><p>Tu proyecto esta entregado. Adjunto encontraras el acta de entrega oficial con el detalle de todo el trabajo realizado.</p><p>En el acta veras un codigo QR. Si lo escaneas con el movil y metes el PIN que te enviare en otro email, podras consultar todas las contrasenas y accesos de tu proyecto en una pagina segura.</p><p>Cualquier duda durante los proximos 30 dias (periodo de garantia), respondeme y lo solucionamos.</p><p>Gracias por confiar en Conecta Nex.</p><p>Un saludo,<br>{{emisor_nombre}}</p>',
    'Entrega',
    4
  ),
  (
    'Email vacio',
    'Plantilla en blanco para empezar de cero.',
    'Sobre tu proyecto - {{cliente_nombre}}',
    '<p>Hola {{cliente_nombre}},</p><p>[Tu mensaje aqui]</p><p>Un saludo,<br>{{emisor_nombre}}</p>',
    'General',
    99
  )
) AS v(nombre, descripcion, asunto, cuerpo_html, categoria, orden)
WHERE NOT EXISTS (SELECT 1 FROM email_plantillas LIMIT 1);
