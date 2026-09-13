// Diseno de oferta y brief del agente de IA, colgado del prospecto.
//
//   GET    ?prospecto_id=N            -> devuelve el diseno (o uno vacio)
//   PUT    { prospecto_id, ... }      -> guarda (upsert)
//   POST   { accion:'a_propuesta', prospecto_id }
//                                     -> crea una propuesta en borrador con los
//                                        elementos disenados, ordenados por
//                                        puntuacion (el nucleo primero)
//
// De aqui bebe api/propuestas.js: el brief entra en el prompt de la IA para que
// el diagnostico hable del negocio real y no de generalidades.
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

let _mig = false;
async function asegurarTabla() {
  if (_mig) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS diseno_oferta (
      id SERIAL PRIMARY KEY,
      prospecto_id INTEGER UNIQUE,
      cliente_id INTEGER,
      nicho TEXT DEFAULT '',
      brief_comun JSONB DEFAULT '{}'::jsonb,
      brief_nicho JSONB DEFAULT '{}'::jsonb,
      items_json JSONB DEFAULT '[]'::jsonb,
      avatares_json JSONB DEFAULT '[]'::jsonb,
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    )`;
  } catch { /* noop */ }
  try { await sql`CREATE INDEX IF NOT EXISTS idx_diseno_prospecto ON diseno_oferta (prospecto_id)`; } catch { /* noop */ }
  _mig = true;
}

const VACIO = { nicho: '', brief_comun: {}, brief_nicho: {}, items_json: [], avatares_json: [] };

// Lectura reutilizable: la usa tambien propuestas.js para alimentar a la IA.
export async function leerDiseno(prospectoId) {
  await asegurarTabla();
  const pid = parseInt(prospectoId, 10);
  if (!pid) return null;
  const [row] = await sql`SELECT * FROM diseno_oferta WHERE prospecto_id = ${pid}`;
  return row || null;
}

/**
 * El brief en texto plano, para meterselo a la IA (propuesta o email).
 * Vive aqui, junto al dato, para que lo pueda usar cualquier endpoint.
 */
export function resumirBrief(dis) {
  if (!dis) return '';
  const c = dis.brief_comun || {};
  const n = dis.brief_nicho || {};
  const l = [];
  if (dis.nicho) l.push(`Sector del brief: ${dis.nicho}`);
  const linea = (etiqueta, valor) => { if (valor && String(valor).trim()) l.push(`${etiqueta}: ${String(valor).trim().slice(0, 400)}`); };
  linea('Que tiene que conseguir el agente', c.objetivo);
  linea('Canales', c.canales);
  linea('Quien atiende hoy', c.situacion);
  linea('Horario', c.horario);
  linea('Prohibido decir', c.lineasRojas);
  linea('Preguntas mas frecuentes', c.faq);
  linea('Por que le compran a el', c.diferencial);
  linea('Como se le cobra', c.importes || c.modeloPrecio);
  linea('Cifra que hay que mover', [c.kpi, c.partida && `hoy ${c.partida}`, c.meta && `meta ${c.meta}`].filter(Boolean).join(' · '));
  for (const [k, v] of Object.entries(n)) linea(`Del sector (${k})`, v);

  const avatares = Array.isArray(dis.avatares_json) ? dis.avatares_json.slice(0, 3) : [];
  for (const a of avatares) {
    const partes = [a.dolor_corto, a.dolor && `le duele: ${a.dolor}`, a.no && `dice NO si: ${a.no}`, a.si && `dice SI si: ${a.si}`].filter(Boolean);
    if (partes.length) l.push(`Cliente tipo "${a.nombre}": ${partes.join(' | ').slice(0, 400)}`);
  }

  const items = Array.isArray(dis.items_json) ? dis.items_json : [];
  if (items.length) {
    const pts = (i) => (i.puntos?.complementa || 0) + (i.puntos?.objecion || 0) + (i.puntos?.valor || 0) + (i.puntos?.esfuerzo || 0);
    const top = [...items].sort((a, b) => pts(b) - pts(a)).slice(0, 3).map((i) => i.nombre).filter(Boolean);
    if (top.length) l.push(`Nucleo de la oferta ya decidido (usalo como eje): ${top.join(', ')}`);
  }
  return l.join('\n');
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const puntos = (p) => {
  const e = (v) => Math.min(5, Math.max(1, parseInt(v, 10) || 3));
  return { complementa: e(p?.complementa), objecion: e(p?.objecion), valor: e(p?.valor), esfuerzo: e(p?.esfuerzo) };
};
const totalPuntos = (p) => p.complementa + p.objecion + p.valor + p.esfuerzo;

// Nunca se guarda lo que llega del navegador tal cual: precios a >= 0 y
// puntuaciones dentro de rango, o los totales de la propuesta salen absurdos.
function saneaItems(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 100).map((i) => ({
    id: String(i?.id || crypto.randomUUID()),
    nombre: String(i?.nombre || 'Sin nombre').slice(0, 200),
    precio: Math.max(0, num(i?.precio)),
    precio_oferta: Math.max(0, num(i?.precio_oferta)),
    descuento_max: Math.min(100, Math.max(0, num(i?.descuento_max))),
    plazos: { numero: Math.min(120, Math.max(0, parseInt(i?.plazos?.numero, 10) || 0)), monto: Math.max(0, num(i?.plazos?.monto)) },
    columna: ['front', 'back'].includes(i?.columna) ? i.columna : 'sin-asignar',
    best_seller: i?.best_seller === true,
    puntos: puntos(i?.puntos),
  }));
}

function saneaAvatares(lista) {
  if (!Array.isArray(lista)) return [];
  const t = (v) => (typeof v === 'string' ? v.slice(0, 2000) : '');
  const coord = (v) => Math.min(94, Math.max(6, num(v) || 50));
  return lista.slice(0, 40).map((a) => ({
    id: String(a?.id || crypto.randomUUID()),
    nombre: String(a?.nombre || 'Sin nombre').slice(0, 200),
    dolor_corto: t(a?.dolor_corto),
    x: coord(a?.x),
    y: coord(a?.y),
    dolor: t(a?.dolor),
    sueno: t(a?.sueno),
    no: t(a?.no),
    si: t(a?.si),
  }));
}

const soloTextos = (o) => {
  if (!o || typeof o !== 'object') return {};
  const salida = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === 'string') salida[String(k).slice(0, 60)] = v.slice(0, 4000);
  return salida;
};

export default async function handler(req, res) {
  const auth = checkAuth(req);
  // La automatizacion (cron / volcado a propuesta tras una cita) se autentica con
  // CRON_SECRET en el body, igual que en propuestas.js y clientes.js.
  const cronOk = req.method === 'POST' && !!process.env.CRON_SECRET && req.body?.secret === process.env.CRON_SECRET;
  if (!auth.ok && !cronOk) return jsonResponse(res, 401, { error: auth.error });

  try {
    await asegurarTabla();

    if (req.method === 'GET') {
      const pid = parseInt(req.query.prospecto_id, 10);
      if (!pid) return jsonResponse(res, 400, { error: 'Falta prospecto_id' });
      const row = await leerDiseno(pid);
      return jsonResponse(res, 200, row || { prospecto_id: pid, ...VACIO });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      const pid = parseInt(b.prospecto_id, 10);
      if (!pid) return jsonResponse(res, 400, { error: 'Falta prospecto_id' });

      const nicho = String(b.nicho || '').slice(0, 40);
      const comun = soloTextos(b.brief_comun);
      const briefNicho = soloTextos(b.brief_nicho);
      const items = saneaItems(b.items_json);
      const avatares = saneaAvatares(b.avatares_json);

      const [row] = await sql`
        INSERT INTO diseno_oferta (prospecto_id, cliente_id, nicho, brief_comun, brief_nicho, items_json, avatares_json)
        VALUES (${pid}, ${b.cliente_id ? parseInt(b.cliente_id, 10) : null}, ${nicho},
                ${JSON.stringify(comun)}::jsonb, ${JSON.stringify(briefNicho)}::jsonb,
                ${JSON.stringify(items)}::jsonb, ${JSON.stringify(avatares)}::jsonb)
        ON CONFLICT (prospecto_id) DO UPDATE SET
          cliente_id = COALESCE(EXCLUDED.cliente_id, diseno_oferta.cliente_id),
          nicho = EXCLUDED.nicho,
          brief_comun = EXCLUDED.brief_comun,
          brief_nicho = EXCLUDED.brief_nicho,
          items_json = EXCLUDED.items_json,
          avatares_json = EXCLUDED.avatares_json,
          actualizado_en = NOW()
        RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.accion !== 'a_propuesta') return jsonResponse(res, 400, { error: 'Accion no valida' });
      const pid = parseInt(b.prospecto_id, 10);
      if (!pid) return jsonResponse(res, 400, { error: 'Falta prospecto_id' });

      const dis = await leerDiseno(pid);
      const items = Array.isArray(dis?.items_json) ? dis.items_json : [];
      if (!items.length) return jsonResponse(res, 400, { error: 'El diseno no tiene ningun elemento todavia.' });

      const [p] = await sql`SELECT * FROM prospectos WHERE id = ${pid}`;
      if (!p) return jsonResponse(res, 404, { error: 'Prospecto no encontrado' });

      // El nucleo primero: lo que mas puntua en el scorecard encabeza la propuesta.
      const lineas = [...items]
        .sort((a, c) => totalPuntos(c.puntos) - totalPuntos(a.puntos))
        .map((i) => ({ nombre: i.nombre, precio: i.precio_oferta > 0 ? i.precio_oferta : i.precio, cantidad: 1 }));
      const total = lineas.reduce((t, l) => t + Number(l.precio || 0), 0);

      const anio = new Date().getFullYear();
      const [{ numero }] = await sql`
        INSERT INTO contadores (clave, valor) VALUES (${'propuesta_' + anio}, 1)
        ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW()
        RETURNING 'PROP-' || ${String(anio)} || '-' || LPAD(valor::text, 4, '0') AS numero`;

      const tok = crypto.randomBytes(24).toString('base64url');
      const [row] = await sql`
        INSERT INTO propuestas (prospecto_id, numero, titulo, intro, items_json, descuento, total, validez_dias, estado, token, destinatario_email, destinatario_nombre)
        VALUES (${pid}, ${numero}, ${'Propuesta de servicios'}, ${''}, ${JSON.stringify(lineas)}::jsonb,
                ${0}, ${total}, ${15}, ${'borrador'}, ${tok}, ${p.email || ''}, ${p.empresa || p.nombre || ''})
        RETURNING *`;
      return jsonResponse(res, 200, { propuesta: row, lineas: lineas.length });
    }

    return jsonResponse(res, 405, { error: 'Metodo no permitido' });
  } catch (err) {
    console.error('diseno error:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
