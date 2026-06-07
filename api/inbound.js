// Webhook PUBLICO que recibe los emails entrantes (respuestas) del proveedor
// de correo (Resend Inbound, Cloudflare Email Workers, Mailgun, etc.) y los
// guarda en mensajes_recibidos para verlos en la Bandeja del panel.
//
// Seguridad: si defines INBOUND_TOKEN en Vercel, el webhook exige ?token=ESE.
// Configura en tu proveedor la URL:  https://clientes.conectanex.com/api/inbound?token=XXXX
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';

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
    const d = b.data || b; // Resend envuelve en { type, data }
    const de = String(d.from?.address || d.from || d.sender || d.From || '').trim();
    const toRaw = Array.isArray(d.to) ? (d.to[0]?.address || d.to[0]) : (d.to || d.To || d.recipient || '');
    const para = String(toRaw || '').trim();
    const asunto = String(d.subject || d.Subject || '');
    const texto = String(d.text || d['stripped-text'] || d['body-plain'] || '');
    const html = String(d.html || d['body-html'] || '');

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
    await sql`INSERT INTO mensajes_recibidos (de, para, asunto, texto, html, prospecto_id, cliente_id)
      VALUES (${de}, ${para}, ${asunto}, ${texto}, ${html}, ${prospecto_id}, ${cliente_id})`;
    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('inbound error:', err);
    // 200 para que el proveedor no reintente en bucle; queda en logs.
    return jsonResponse(res, 200, { ok: false });
  }
}
