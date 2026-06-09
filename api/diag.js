// AUDITORIA TEMPORAL de accesos Resend. Borrar tras usar.
// GET /api/diag?token=diag123
import { jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  if (req.query.token !== 'diag123') return jsonResponse(res, 401, { error: 'no auth' });
  const key = process.env.RESEND_API_KEY;
  const out = { from_email: process.env.RESEND_FROM_EMAIL || null, reply_to: process.env.REPLY_TO_EMAIL || null, claveEmpieza: key ? key.slice(0, 7) : null };
  const H = { headers: { Authorization: `Bearer ${key}` } };
  const probe = async (label, url) => {
    try { const r = await fetch(url, H); const t = await r.text(); out[label] = { status: r.status, body: t.slice(0, 800) }; return t; }
    catch (e) { out[label] = { error: String(e) }; return null; }
  };
  if (!key) return jsonResponse(res, 200, out);
  await probe('apikeys', 'https://api.resend.com/api-keys');
  await probe('dominios', 'https://api.resend.com/domains');
  const listaTxt = await probe('lista_recibidos', 'https://api.resend.com/emails/receiving');
  // Si la lista trae ids, intenta traer el primero
  try {
    const j = JSON.parse(listaTxt || '{}');
    const first = j?.data?.[0]?.id;
    if (first) await probe('get_de_la_lista', `https://api.resend.com/emails/receiving/${first}`);
  } catch { /* */ }
  return jsonResponse(res, 200, out);
}
