// Webhook PUBLICO de Resend Inbound: recibe los emails entrantes (respuestas)
// y los guarda en mensajes_recibidos para verlos en la Bandeja del panel.
// El webhook SOLO trae metadatos; el cuerpo se trae con el email_id (puede
// tardar unos segundos, por eso se reintenta y, si no, se completa al abrir
// la Bandeja - ver api/mensajes.js).
//
// Seguridad: si defines INBOUND_TOKEN en Vercel, exige ?token=ESE.
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { traerContenidoResend } from './_resend.js';

const soloEmail = (s) => {
  const m = String(s || '').match(/[^\s<>"]+@[^\s<>"]+/);
  return m ? m[0].toLowerCase() : '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const token = process.env.INBOUND_TOKEN;
  if (token && req.query.token !== token) return jsonResponse(res, 401, { error: 'no auth' });
  try {
    const b = req.body || {};
    try {
      const ip = String(req.headers['x-forwarded-for'] || 'webhook').split(',')[0];
      await sql`INSERT INTO peticiones_publicas (ip, ruta) VALUES (${ip}, ${'inbound:' + (b.type || 'sin-tipo')})`;
    } catch { /* log opcional */ }
    // DEBUG temporal: guarda el payload crudo para ver que campos manda Resend.
    try { await sql`INSERT INTO inbound_debug (payload) VALUES (${JSON.stringify(b)})`; } catch { /* debug opcional */ }
    if (b.type && b.type !== 'email.received' && b.type !== 'inbound.email') return jsonResponse(res, 200, { ok: true, ignorado: b.type });

    const d = b.data || b;
    let de = String(d.from?.address || d.from || d.sender || d.From || '').trim();
    let toRaw = Array.isArray(d.to) ? (d.to[0]?.address || d.to[0]) : (d.to || d.To || d.recipient || '');
    let asunto = String(d.subject || d.Subject || '');
    let texto = String(d.text || '');
    let html = String(d.html || '');
    const emailId = d.email_id || d.id || null;

    // Intenta traer el cuerpo ya (a veces esta listo enseguida). Si no, se
    // completara al abrir la Bandeja gracias al email_id guardado.
    if (!texto && !html && emailId) {
      const full = await traerContenidoResend(emailId, 1);
      if (full) {
        de = full.from || de;
        if (full.to) toRaw = full.to;
        asunto = full.subject || asunto;
        texto = full.text || '';
        html = full.html || '';
      }
    }
    const para = String(toRaw || '').trim();

    let prospecto_id = null, cliente_id = null;
    const correo = soloEmail(de);
    if (correo) {
      const [p] = await sql`SELECT id FROM prospectos WHERE lower(email) = ${correo} LIMIT 1`;
      if (p) { prospecto_id = p.id; await sql`UPDATE prospectos SET estado = 'respondido', actualizado_en = NOW() WHERE id = ${p.id} AND estado != 'convertido'`; }
      const [c] = await sql`SELECT id FROM clientes WHERE lower(email) = ${correo} LIMIT 1`;
      if (c) cliente_id = c.id;
    }
    if (!de && !asunto && !emailId) return jsonResponse(res, 200, { ok: true, vacio: true });

    await sql`INSERT INTO mensajes_recibidos (de, para, asunto, texto, html, prospecto_id, cliente_id, email_id)
      VALUES (${de}, ${para}, ${asunto}, ${texto}, ${html}, ${prospecto_id}, ${cliente_id}, ${emailId})`;

    // Reenvia copia a tu Gmail (con el cuerpo si ya lo tenemos; si no, un aviso).
    try {
      const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
      const destino = process.env.AGENCY_EMAIL || em?.email;
      if (destino && emailHabilitado()) {
        const cuerpo = html || (texto ? `<pre style="font-family:sans-serif;white-space:pre-wrap">${String(texto).replace(/</g, '&lt;')}</pre>` : '<p style="color:#777">Abre la Bandeja del panel para ver el contenido completo.</p>');
        await enviarEmail({
          to: destino,
          subject: `Respuesta de ${de || 'un prospecto'}: ${asunto || '(sin asunto)'}`,
          html: `<p style="color:#555">Nueva respuesta de <b>${de}</b>. Tambien la tienes en la Bandeja del panel.</p><hr>${cuerpo}`,
          replyTo: correo || undefined,
        });
      }
    } catch { /* reenvio opcional */ }
    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('inbound error:', err);
    return jsonResponse(res, 200, { ok: false });
  }
}
