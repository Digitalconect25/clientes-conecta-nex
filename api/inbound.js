// Webhook PUBLICO que recibe los emails entrantes (respuestas) del proveedor
// de correo (Resend Inbound, Cloudflare Email Workers, Mailgun, etc.) y los
// guarda en mensajes_recibidos para verlos en la Bandeja del panel.
//
// Seguridad: si defines INBOUND_TOKEN en Vercel, el webhook exige ?token=ESE.
// Configura en tu proveedor la URL:  https://clientes.conectanex.com/api/inbound?token=XXXX
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';

const soloEmail = (s) => {
  const m = String(s || '').match(/[^\s<>"]+@[^\s<>"]+/);
  return m ? m[0].toLowerCase() : '';
};

// El webhook de Resend solo trae METADATOS (no el cuerpo). Hay que pedir el
// contenido completo a la API de emails recibidos con el email_id.
async function traerContenido(emailId) {
  if (!emailId || !process.env.RESEND_API_KEY) return null;
  try {
    const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const token = process.env.INBOUND_TOKEN;
  if (token && req.query.token !== token) return jsonResponse(res, 401, { error: 'no auth' });
  try {
    const b = req.body || {};
    // Resend envia { type:'email.received', data:{...} }. Ignora otros eventos.
    if (b.type && b.type !== 'email.received' && b.type !== 'inbound.email') return jsonResponse(res, 200, { ok: true, ignorado: b.type });
    const d = b.data || b;
    let de = String(d.from?.address || d.from || d.sender || d.From || '').trim();
    let toRaw = Array.isArray(d.to) ? (d.to[0]?.address || d.to[0]) : (d.to || d.To || d.recipient || '');
    let asunto = String(d.subject || d.Subject || '');
    let texto = String(d.text || d['stripped-text'] || d['body-plain'] || '');
    let html = String(d.html || d['body-html'] || '');

    // Resend solo manda metadatos: si falta el cuerpo, lo pedimos a su API.
    const emailId = d.email_id || d.id || null;
    if (!texto && !html && emailId) {
      const full = await traerContenido(emailId);
      if (full) {
        de = String(full.from || de).trim();
        if (Array.isArray(full.to) && full.to[0]) toRaw = full.to[0];
        asunto = String(full.subject || asunto);
        texto = String(full.text || texto || '');
        html = String(full.html || html || '');
      }
    }
    const para = String(toRaw || '').trim();

    let prospecto_id = null, cliente_id = null;
    const correo = soloEmail(de);
    if (correo) {
      const [p] = await sql`SELECT id FROM prospectos WHERE lower(email) = ${correo} LIMIT 1`;
      if (p) {
        prospecto_id = p.id;
        await sql`UPDATE prospectos SET estado = 'respondido', actualizado_en = NOW() WHERE id = ${p.id} AND estado != 'convertido'`;
      }
      const [c] = await sql`SELECT id FROM clientes WHERE lower(email) = ${correo} LIMIT 1`;
      if (c) cliente_id = c.id;
    }
    // Si no parece un email real (sin remitente y sin asunto), no guardes basura.
    if (!de && !asunto && !texto && !html) return jsonResponse(res, 200, { ok: true, vacio: true });

    await sql`INSERT INTO mensajes_recibidos (de, para, asunto, texto, html, prospecto_id, cliente_id)
      VALUES (${de}, ${para}, ${asunto}, ${texto}, ${html}, ${prospecto_id}, ${cliente_id})`;

    // Ademas, reenvia una copia a tu Gmail (asi tambien la ves en tu correo).
    try {
      const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
      const destino = process.env.AGENCY_EMAIL || em?.email;
      if (destino && emailHabilitado()) {
        const cuerpo = html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${String(texto).replace(/</g, '&lt;')}</pre>`;
        await enviarEmail({
          to: destino,
          subject: `Respuesta de ${de || 'un prospecto'}: ${asunto || '(sin asunto)'}`,
          html: `<p style="color:#555">Nueva respuesta recibida de <b>${de}</b>. Tambien la tienes en la Bandeja del panel.</p><hr>${cuerpo}`,
          replyTo: correo || undefined,
        });
      }
    } catch { /* el reenvio es opcional */ }
    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('inbound error:', err);
    // 200 para que el proveedor no reintente en bucle; queda en logs.
    return jsonResponse(res, 200, { ok: false });
  }
}
