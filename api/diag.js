// DIAGNOSTICO TEMPORAL: prueba el endpoint de Resend para traer el cuerpo de un
// email recibido, con la clave real del servidor. Borrar tras diagnosticar.
// Uso: GET /api/diag?token=diag123&id=<email_id>  (si no pasas id, usa el ultimo)
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  if (req.query.token !== 'diag123') return jsonResponse(res, 401, { error: 'no auth' });
  const key = process.env.RESEND_API_KEY;
  const out = { tieneClave: !!key, claveEmpieza: key ? key.slice(0, 6) : null };
  try {
    let id = req.query.id;
    if (!id) {
      const [r] = await sql`SELECT payload FROM inbound_debug ORDER BY id DESC LIMIT 1`;
      id = r?.payload?.data?.email_id || null;
    }
    out.email_id = id;
    if (!id || !key) return jsonResponse(res, 200, out);

    for (const fmt of ['data_uri', 'cid']) {
      const r = await fetch(`https://api.resend.com/emails/receiving/${id}?html_format=${fmt}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const txt = await r.text();
      out[`fmt_${fmt}`] = { status: r.status, body: txt.slice(0, 600) };
    }
  } catch (e) {
    out.error = String(e);
  }
  return jsonResponse(res, 200, out);
}
