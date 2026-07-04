// Vercel Cron (8:00 lun-sab): ciclo diario del AGENTE DE CAPTACION.
// ORDEN IMPORTANTE: primero los pasos ligeros y garantizados, y el scrapeo pesado
// (ciclo_diario) al FINAL, para que un timeout del scrapeo no impida enviar,
// hacer seguimientos ni recalcular la evolucion.
//   1) enviar_auto: envia los leads YA listos (los scrapeados en dias anteriores,
//      con su email de valor + plan de 120 dias redactado). Asi hay una ventana
//      natural de ~24h entre que se capta un lead y se le escribe (revisable).
//   2) seguimientos: follow-ups a quien no respondio en unos dias.
//   3) redactar_pro: refina/personaliza los mas probables (diagnostico + plan).
//   4) evolucionar: recalcula la evolucion del embudo (frio -> caliente -> cliente).
//   5) ciclo_diario: scrapea la ciudad con el nicho que toque (lo mas pesado).
// Seguridad: Vercel Cron envia "Authorization: Bearer CRON_SECRET" si esta en el entorno.
import { jsonResponse } from './_auth.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  const base = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
  const t0 = Date.now();
  // Presupuesto de tiempo: no arrancar un paso nuevo si quedan < 8s del limite del handler.
  const margen = () => (Date.now() - t0) < 52000;
  const llamar = (accion, extra = {}) => fetch(`${base}/api/prospectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, secret, ...extra }),
    signal: AbortSignal.timeout(45000), // ningun sub-request acapara todo el presupuesto
  }).then((r) => r.json().catch(() => ({}))).catch((e) => ({ error: e.message }));

  const out = {};
  try {
    if (margen()) out.enviar_auto = await llamar('enviar_auto', { limite: 10 }); // 1) envia lo ya listo (leads de dias previos)
    if (margen()) out.seguimientos = await llamar('seguimientos', { limite: 8 }); // 2) follow-ups
    if (margen()) out.redactar_pro = await llamar('redactar_pro', { limite: 6 }); // 3) refina los mas probables
    if (margen()) out.evolucion = await llamar('evolucionar');                    // 4) recalcula el embudo
    if (margen()) out.ciclo_diario = await llamar('ciclo_diario');                // 5) scrapeo del dia (lo mas pesado, al final)
    return jsonResponse(res, 200, { ok: true, ...out });
  } catch (e) {
    return jsonResponse(res, 200, { ok: false, error: e.message, ...out });
  }
}
