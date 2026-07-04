// Vercel Cron (8:00 lun-sab): ciclo diario del AGENTE DE CAPTACION.
// ORDEN: primero lo barato/garantizado y el scrapeo pesado (ciclo_diario) al FINAL,
// para que un timeout del scrapeo no impida enviar, seguir ni recalcular el embudo.
//   1) evolucionar: recalcula el embudo (barato) -> siempre corre.
//   2) enviar_auto: envia los leads YA listos (captados en dias previos, con su email
//      de valor + plan de 120 dias). Ventana natural de ~24h entre captacion y contacto.
//   3) seguimientos: follow-ups a quien no respondio.
//   4) redactar_pro: refina/personaliza los mas probables (diagnostico + plan).
//   5) ciclo_diario: scrapea la ciudad con el nicho que toque (lo mas pesado, al final).
// El presupuesto de tiempo (BUDGET) se reparte: cada paso recibe un timeout = lo que
// queda del presupuesto (con un tope por paso), y si no queda margen NO se arranca.
import { jsonResponse } from './_auth.js';

// maxDuration alto para dar cabida a la cadena; Vercel lo capa al maximo del plan.
export const maxDuration = 300;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  const base = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
  const t0 = Date.now();
  const BUDGET = (maxDuration - 15) * 1000;       // reserva 15s para cerrar la respuesta
  const restante = () => BUDGET - (Date.now() - t0);
  // Timeout de cada sub-request: lo que queda del presupuesto, con tope de 60s
  // (cada /api/prospectos tiene su propio maxDuration=60) y minimo util de 6s.
  const llamar = (accion, extra = {}, minMs = 6000, topeMs = 60000) => {
    const to = Math.min(restante(), topeMs);
    if (to < minMs) return Promise.resolve({ saltado: 'sin margen de tiempo' });
    return fetch(`${base}/api/prospectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, secret, ...extra }),
      signal: AbortSignal.timeout(to),
    }).then((r) => r.json().catch(() => ({}))).catch((e) => ({ error: e.message }));
  };

  const out = {};
  try {
    out.evolucion = await llamar('evolucionar', {}, 4000, 30000);    // 1) barato, primero
    out.enriquecer = await llamar('enriquecer', { limite: 20 });     // 2) rescata emails de leads con web pero sin email
    out.puntuar = await llamar('puntuar_todos');                     // 3) califica los que quedaron sin prioridad (importados/creados)
    out.enviar_auto = await llamar('enviar_auto', { limite: 20 });   // 4) envia lo ya listo (mayor prioridad primero)
    out.seguimientos = await llamar('seguimientos', { limite: 8 });  // 5) follow-ups
    out.redactar_pro = await llamar('redactar_pro', { limite: 6 });  // 6) refina los mas probables
    out.ciclo_diario = await llamar('ciclo_diario');                 // 7) scrapeo del dia (lo mas pesado, al final)
    return jsonResponse(res, 200, { ok: true, ...out });
  } catch (e) {
    return jsonResponse(res, 200, { ok: false, error: e.message, ...out });
  }
}
