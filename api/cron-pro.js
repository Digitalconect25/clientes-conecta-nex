// Vercel Cron (8:00 lun-sab): ciclo diario del AGENTE DE CAPTACION.
// 1) ciclo_diario: scrapea la ciudad configurada con el nicho que toque (rotan),
//    mete los leads EN FRIO, la IA los prioriza, busca su email y redacta el 1er contacto.
// 2) redactar_pro: personaliza los mas probables (investiga el negocio en internet).
// 3) enviar_auto: envia hasta 10/dia (Prioridad Alta primero) -> pasan a Contactados.
// 4) seguimientos: redacta follow-ups a quien no respondio en unos dias.
// 5) evolucionar: recalcula la evolucion del embudo (frio -> interesado -> caliente -> cliente).
// Seguridad: Vercel Cron envia "Authorization: Bearer CRON_SECRET" si CRON_SECRET esta en el entorno.
import { jsonResponse } from './_auth.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  const base = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
  const llamar = (accion, extra = {}) => fetch(`${base}/api/prospectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, secret, ...extra }),
  }).then((r) => r.json().catch(() => ({}))).catch((e) => ({ error: e.message }));
  try {
    const ciclo = await llamar('ciclo_diario');               // 1) scrapeo diario por ciudad (si el agente esta activo)
    const env = await llamar('enviar_auto', { limite: 10 });  // 2) envia los borradores listos (Prioridad Alta primero)
    const pro = await llamar('redactar_pro', { limite: 6 });  // 3) personaliza los mas probables para manana
    const seg = await llamar('seguimientos', { limite: 8 });  // 4) follow-ups a los que no respondieron
    const evo = await llamar('evolucionar');                  // 5) recalcula la evolucion del embudo
    return jsonResponse(res, 200, { ok: true, ciclo_diario: ciclo, enviar_auto: env, redactar_pro: pro, seguimientos: seg, evolucion: evo });
  } catch (e) {
    return jsonResponse(res, 200, { ok: false, error: e.message });
  }
}
