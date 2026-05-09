import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { cifrar } from './_crypto.js';
import { enviarEmail, emailHabilitado } from './_email.js';

// Genera un PIN aleatorio de 5 digitos (00000-99999)
function generarPIN() {
  const n = crypto.randomInt(0, 100000);
  return String(n).padStart(5, '0');
}

// Genera un token aleatorio de 32 chars hex (64 caracteres en total).
// Es lo que va en la URL del QR. No predecible.
function generarToken() {
  return crypto.randomBytes(24).toString('base64url'); // 32 chars URL-safe
}

// Genera un codigo de aceptacion legible: ACT-2026-CLNNNN-AAAAA
async function generarCodigoAceptacion(clienteId, anio) {
  const claveAnual = `acta_${anio}`;
  const [row] = await sql`
    INSERT INTO contadores (clave, valor)
    VALUES (${claveAnual}, 1)
    ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW()
    RETURNING valor
  `;
  const num = String(row.valor).padStart(4, '0');
  // 5 chars random alfanumericos (sin O, 0, I, l para evitar confusion visual)
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += charset[crypto.randomInt(0, charset.length)];
  }
  return `ACT-${anio}-${num}-${suffix}`;
}

function plantillaEmailPIN(cliente, codigoAceptacion, pin, urlBase) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Acta de entrega - Conecta Nex</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.6;">

<div style="text-align: center; padding: 20px 0; border-bottom: 3px solid #047857;">
  <h1 style="color: #047857; margin: 0; font-size: 24px;">Conecta Nex</h1>
  <p style="color: #666; margin: 5px 0 0; font-size: 13px;">Servicios digitales para empresas y profesionales</p>
</div>

<h2 style="color: #047857; font-size: 18px;">Hola ${cliente.nombre},</h2>

<p>Tu proyecto ha sido entregado y firmado. Junto con el acta en papel o PDF, tienes acceso a una zona privada online donde puedes consultar todos los accesos y contrasenas de tu proyecto en cualquier momento.</p>

<p>Para mantener tu informacion segura, hemos separado el acceso en dos partes que SOLO juntas funcionan:</p>

<ol>
  <li><strong>El codigo QR</strong> que aparece en tu acta firmada (en el papel o el PDF).</li>
  <li><strong>Este PIN</strong> de 5 digitos que recibes ahora por email.</li>
</ol>

<div style="background: #f0fdf4; border-left: 4px solid #047857; padding: 20px; margin: 30px 0; border-radius: 4px;">
  <p style="margin: 0; font-size: 14px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Tu PIN de acceso</p>
  <p style="margin: 10px 0 0; font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #047857;">${pin}</p>
</div>

<h3 style="color: #047857; font-size: 16px;">Como usarlo</h3>
<ol>
  <li>Coge tu acta de entrega (papel o PDF).</li>
  <li>Escanea con tu movil el codigo QR que aparece al final.</li>
  <li>Se te abrira una pagina pidiendote el PIN.</li>
  <li>Introduce el PIN: <strong>${pin}</strong></li>
  <li>Veras todos tus accesos y contrasenas.</li>
</ol>

<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 4px; font-size: 13px;">
  <strong>Importante:</strong>
  <ul style="margin: 6px 0 0; padding-left: 20px;">
    <li>Guarda este email en un lugar seguro.</li>
    <li>El PIN es personal e intransferible. No lo compartas con nadie.</li>
    <li>Tras 3 intentos fallidos seguidos, el acceso se bloquea durante 1 hora por seguridad.</li>
    <li>Si pierdes el acta o el PIN, contactanos.</li>
  </ul>
</div>

<p style="font-size: 13px; color: #666;">Tu codigo de aceptacion es <strong>${codigoAceptacion}</strong>. Sirve como referencia oficial de la entrega del proyecto.</p>

<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

<p style="font-size: 12px; color: #999; text-align: center;">
Conecta Nex - Servicios Digital Conect<br>
Calle Alberola 24, 03007 Alicante<br>
info.digitalconect@gmail.com - 611 986 107
</p>

</body>
</html>
  `.trim();
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { cliente_id, documento_id, enviar_email } = req.body || {};
    if (!cliente_id) return jsonResponse(res, 400, { error: 'Falta cliente_id' });

    const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${cliente_id}`;
    if (!cliente) return jsonResponse(res, 404, { error: 'Cliente no encontrado' });

    // Generar piezas de seguridad
    const pin = generarPIN();
    const token = generarToken();
    const anio = new Date().getFullYear();
    const codigoAceptacion = await generarCodigoAceptacion(cliente_id, anio);

    // Guardar en BD con PIN cifrado
    const pinCifrado = cifrar(pin);
    const [row] = await sql`
      INSERT INTO accesos_acta (cliente_id, documento_id, token, pin_cifrado, codigo_aceptacion)
      VALUES (${cliente_id}, ${documento_id || null}, ${token}, ${pinCifrado}, ${codigoAceptacion})
      RETURNING id, cliente_id, documento_id, token, codigo_aceptacion, creado_en
    `;

    // Construir URL publica
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'clientes-conecta-nex.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const urlBase = `${proto}://${host}`;
    const urlAcceso = `${urlBase}/acceso/${token}`;

    // Enviar email con el PIN al cliente
    let emailResultado = null;
    if (enviar_email && cliente.email && emailHabilitado()) {
      try {
        const html = plantillaEmailPIN(cliente, codigoAceptacion, pin, urlBase);
        const r = await enviarEmail({
          to: cliente.email,
          subject: `Acceso seguro a tu proyecto - PIN ${codigoAceptacion}`,
          html,
        });
        await sql`
          UPDATE accesos_acta
          SET email_enviado = TRUE, fecha_envio_email = NOW()
          WHERE id = ${row.id}
        `;
        emailResultado = { ok: true, id: r.id };
      } catch (err) {
        emailResultado = { ok: false, error: err.message };
      }
    }

    // Devolvemos datos para que el frontend pueda mostrar todo en el panel:
    // PIN visible para Lazaro, URL del QR, codigo de aceptacion
    return jsonResponse(res, 200, {
      id: row.id,
      token,
      pin,
      codigo_aceptacion: codigoAceptacion,
      url_acceso: urlAcceso,
      email_resultado: emailResultado,
      email_habilitado: emailHabilitado(),
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
