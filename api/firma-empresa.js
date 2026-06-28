// Endpoint PUBLICO para que el emisor capture su firma desde el movil (tactil).
//   GET  /api/firma-empresa?token=...           -> { firma } actual (para previsualizar)
//   POST /api/firma-empresa?token=...  { firma } -> guarda la firma del emisor (dataURL PNG)
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  try {
    try { await sql`ALTER TABLE emisor ADD COLUMN IF NOT EXISTS firma_token TEXT`; } catch { /* noop */ }
    try { await sql`ALTER TABLE emisor ADD COLUMN IF NOT EXISTS firma_emisor TEXT`; } catch { /* noop */ }
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [e] = await sql`SELECT id, nombre, firma_emisor FROM emisor WHERE firma_token = ${tok}`;
    if (!e) return jsonResponse(res, 404, { error: 'Enlace no válido.' });

    if (req.method === 'GET') return jsonResponse(res, 200, { nombre: e.nombre || '', firma: e.firma_emisor || '' });

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'firmaempresa', 15, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const firma = String(req.body?.firma || '');
      if (!/^data:image\/png;base64,/.test(firma) || firma.length < 200) return jsonResponse(res, 400, { error: 'Dibuja tu firma antes de guardar.' });
      if (firma.length > 600000) return jsonResponse(res, 400, { error: 'La firma es demasiado grande.' });
      await sql`UPDATE emisor SET firma_emisor = ${firma} WHERE id = ${e.id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('firma-empresa error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar.' });
  }
}
