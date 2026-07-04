// Vercel Cron (lunes 9:00): el agente de contenido genera un articulo SEO del
// proximo tema que rota y lo publica en WordPress (o lo deja como borrador si
// auto_publicar=false). Solo actua si el agente de contenido esta activo.
import { jsonResponse } from './_auth.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  const base = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
  try {
    const r = await fetch(`${base}/api/contenido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'ciclo', secret }),
      signal: AbortSignal.timeout(55000),
    }).then((x) => x.json().catch(() => ({}))).catch((e) => ({ error: e.message }));
    return jsonResponse(res, 200, { ok: true, ciclo: r });
  } catch (e) {
    return jsonResponse(res, 200, { ok: false, error: e.message });
  }
}
