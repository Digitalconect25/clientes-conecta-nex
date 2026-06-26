// Vercel Cron: cada ejecucion procesa un lote de los prospectos MAS PROBABLES de aceptacion
// (Prioridad Alta primero) con el agente PRO (investiga + email personalizado). 2 ejecuciones/dia = 10/dia.
// Seguridad: Vercel Cron envia "Authorization: Bearer CRON_SECRET" si CRON_SECRET esta en el entorno.
import { jsonResponse } from './_auth.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  const base = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
  const lote = Math.min(parseInt(req.query.lote, 10) || 5, 6);
  try {
    const r = await fetch(`${base}/api/prospectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'redactar_pro', secret, limite: lote }),
    });
    const data = await r.json().catch(() => ({}));
    return jsonResponse(res, 200, { ok: true, lote, ...data });
  } catch (e) {
    return jsonResponse(res, 200, { ok: false, error: e.message });
  }
}
