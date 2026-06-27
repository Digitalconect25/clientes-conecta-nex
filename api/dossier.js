// Dossier "base para presentar": por cada cita, junta lo que sabemos del negocio
// (prospecto + respuestas del formulario) + investigacion en internet (web + Google)
// y la IA prepara una ficha para llegar a la reunion con una propuesta concreta.
//   POST /api/dossier { id }        -> genera (o regenera) y devuelve { dossier }
//   POST /api/dossier { id, refrescar:false } -> usa el guardado si existe
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { investigarNegocio } from './prospectos.js';

export const maxDuration = 60;

let _migrado = false;
async function asegurarColumnas() {
  if (_migrado) return;
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS dossier text DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS dossier_en timestamptz`; } catch { /* noop */ }
  _migrado = true;
}

// Construye y guarda el dossier de una cita. Reutilizable desde el cron.
export async function generarDossier(citaId) {
  await asegurarColumnas();
  const [cita] = await sql`SELECT * FROM citas WHERE id = ${citaId}`;
  if (!cita) throw new Error('Cita no encontrada');

  let p = null;
  if (cita.prospecto_id) {
    [p] = await sql`SELECT * FROM prospectos WHERE id = ${cita.prospecto_id}`;
  }
  const empresa = (p?.empresa || cita.nombre || '').trim();
  const sector = (p?.sector || '').trim();
  const ciudad = (p?.ciudad || '').trim();
  const website = (p?.website || '').trim();
  const servicios = Array.isArray(p?.servicios_json) ? p.servicios_json.map((s) => s.nombre).filter(Boolean).join(', ') : '';
  const quiere = (cita.nota || '').trim();
  const observaciones = (p?.observaciones || '').trim();

  if (!iaHabilitada()) {
    const txt = `FICHA RAPIDA (IA no configurada)\nNegocio: ${empresa || '-'}\nSector: ${sector || '-'} · Ciudad: ${ciudad || '-'}\nWeb: ${website || 'no tiene'}\nServicios de interes: ${servicios || '-'}\nQue pide: ${quiere || '-'}\nNotas: ${observaciones || '-'}`;
    await sql`UPDATE citas SET dossier = ${txt}, dossier_en = NOW() WHERE id = ${citaId}`;
    return txt;
  }

  // Investigacion en vivo (web + Google) si tenemos algo por donde tirar.
  let web = '', serp = '';
  try { ({ web, serp } = await investigarNegocio({ empresa, ciudad, website })); } catch { /* sin red, seguimos */ }

  const sys = `Eres analista de Conecta Nex (agencia digital de Alicante; ayudamos a negocios a MEJORAR SU PRESENCIA DIGITAL: aparecer en Google y en la IA, web y ficha de Google al dia, resenas, redes). Vas a preparar la BASE para una llamada comercial con un negocio. A partir de la informacion REAL que te doy, escribe una ficha breve y util para el comercial, en espanol de Espana, sin emojis, sin guion largo (em-dash), sin inventar datos (si no sabes algo, no lo afirmes), sin prometer resultados ni mencionar precios.
Estructura EXACTA con estos titulos:
RESUMEN DEL NEGOCIO: <2-3 lineas: a que se dedica, donde, que impresion da>
PRESENCIA DIGITAL HOY: <que tiene y que le falta: web, Google/ficha, resenas, redes; concreto>
OPORTUNIDADES: <3 bullets concretos de mejora prioritarios para ESTE negocio>
PROPUESTA A PRESENTAR: <que le proponemos nosotros, encajado a su caso; 2-3 lineas>
PREGUNTAS PARA LA LLAMADA: <3-4 preguntas para entenderle mejor y cerrar el siguiente paso>`;
  const user = `Negocio: ${empresa || '(sin nombre)'}. Sector: ${sector || '(no indicado)'}. Ciudad: ${ciudad || '(no indicada)'}. Web: ${website || 'no tiene'}.
Servicios que le interesan (del formulario): ${servicios || '(no indicado)'}.
Que pide / nota de la cita: ${quiere || '(no indicada)'}.
Observaciones internas: ${observaciones || '(ninguna)'}.
INFO DE SU WEB: ${web || '(no disponible)'}
INFO DE GOOGLE: ${serp || '(no disponible)'}`;

  const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.4, max_tokens: 800 });
  const dossier = (texto || '').trim();
  await sql`UPDATE citas SET dossier = ${dossier}, dossier_en = NOW() WHERE id = ${citaId}`;
  return dossier;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const id = parseInt(req.body?.id, 10);
    if (!id) return jsonResponse(res, 400, { error: 'Falta id de la cita' });
    await asegurarColumnas();

    if (req.body?.refrescar === false) {
      const [c] = await sql`SELECT dossier FROM citas WHERE id = ${id}`;
      if (c?.dossier) return jsonResponse(res, 200, { dossier: c.dossier, cacheado: true });
    }
    const dossier = await generarDossier(id);
    return jsonResponse(res, 200, { dossier });
  } catch (err) {
    console.error('dossier error:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
