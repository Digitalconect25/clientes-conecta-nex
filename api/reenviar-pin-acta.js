import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { descifrar } from './_crypto.js';
import { enviarEmail, emailHabilitado } from './_email.js';

// Reenvia al cliente el email con el PIN y la URL de acceso del Acta.
// Util si el cliente borro el email original o lo perdio.
//
// Body esperado:
//   { id: <id_acceso_acta>, email_destino?: <opcional, si quieres enviar a otro> }
//
// Si no se pasa email_destino, usa el email del cliente guardado en la BD.

function plantillaEmailReenvioPIN(cliente, codigoAceptacion, pin, urlAcceso) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reenvio de acceso a tu acta - Conecta Nex</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.6;">

<div style="text-align: center; padding: 20px 0; border-bottom: 3px solid #047857;">
  <h1 style="color: #047857; margin: 0; font-size: 24px;">Conecta Nex</h1>
  <p style="color: #666; margin: 5px 0 0; font-size: 13px;">Servicios digitales para empresas y profesionales</p>
</div>

<h2 style="color: #047857; font-size: 18px;">Hola ${cliente.nombre},</h2>

<p>Te reenvio el acceso a la zona privada del acta de tu proyecto, por si perdiste el email original.</p>

<p>El acceso funciona con dos piezas que solo juntas valen:</p>
<ol>
  <li><strong>El codigo QR</strong> que aparece en tu acta firmada (PDF o papel).</li>
  <li><strong>Este PIN</strong> de 5 digitos.</li>
</ol>

<div style="background: #f0fdf4; border-left: 4px solid #047857; padding: 20px; margin: 30px 0; border-radius: 4px;">
  <p style="margin: 0; font-size: 14px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Tu PIN de acceso</p>
  <p style="margin: 10px 0 0; font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #047857;">${pin}</p>
</div>

<p>Si no tienes a mano el acta con el QR, tambien puedes entrar directamente desde aqui:</p>
<p style="text-align: center; margin: 25px 0;">
  <a href="${urlAcceso}" style="display: inline-block; background: #047857; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Abrir mi acceso</a>
</p>

<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 4px; font-size: 13px;">
  <strong>Importante:</strong>
  <ul style="margin: 6px 0 0; padding-left: 20px;">
    <li>Guarda este email. No vuelvas a perderlo.</li>
    <li>El PIN es personal. No lo compartas.</li>
    <li>Tras 3 intentos fallidos seguidos se bloquea 1 hora.</li>
  </ul>
</div>

<p style="font-size: 13px; color: #666;">Codigo de aceptacion: <strong>${codigoAceptacion}</strong>.</p>

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

  if (!emailHabilitado()) {
    return jsonResponse(res, 400, { error: 'Resend no configurado en Vercel' });
  }

  try {
    const { id, email_destino } = req.body || {};
    if (!id) return jsonResponse(res, 400, { error: 'Falta id del acceso al acta' });

    const [acceso] = await sql`SELECT * FROM accesos_acta WHERE id = ${id}`;
    if (!acceso) return jsonResponse(res, 404, { error: 'Acceso al acta no encontrado' });

    if (!acceso.activo) {
      return jsonResponse(res, 400, { error: 'Este acceso esta desactivado. Activalo antes de reenviarlo.' });
    }

    const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${acceso.cliente_id}`;
    if (!cliente) return jsonResponse(res, 404, { error: 'Cliente no encontrado' });

    const destino = (email_destino && email_destino.trim()) || cliente.email;
    if (!destino) {
      return jsonResponse(res, 400, { error: 'El cliente no tiene email guardado. Pon uno en email_destino.' });
    }

    const pin = descifrar(acceso.pin_cifrado);
    if (!pin) {
      return jsonResponse(res, 500, { error: 'No se pudo descifrar el PIN. Genera un acceso nuevo.' });
    }

    // Reconstruir URL publica
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'clientes.conectanex.com';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const urlAcceso = `${proto}://${host}/acceso/${acceso.token}`;

    const html = plantillaEmailReenvioPIN(cliente, acceso.codigo_aceptacion, pin, urlAcceso);
    const r = await enviarEmail({
      to: destino,
      subject: `Reenvio: Acceso seguro a tu proyecto - PIN ${acceso.codigo_aceptacion}`,
      html,
    });

    // Marcar reenvio en BD
    await sql`
      UPDATE accesos_acta
      SET email_enviado = TRUE, fecha_envio_email = NOW(), actualizado_en = NOW()
      WHERE id = ${id}
    `;

    return jsonResponse(res, 200, {
      ok: true,
      destino,
      resend_id: r.id,
    });
  } catch (err) {
    console.error('Error reenviar PIN:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
