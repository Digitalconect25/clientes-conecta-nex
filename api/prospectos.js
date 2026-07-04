import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import crypto from 'node:crypto';

// Escapa texto para incrustarlo en el HTML del email sin romper el maquetado.
const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Ejecuta `fn` sobre `items` con concurrencia acotada (evita saturar el rate-limit
// de Groq y el presupuesto de tiempo de la funcion). Devuelve resultados estilo allSettled.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = { status: 'fulfilled', value: await fn(items[idx], idx) }; }
      catch (e) { out[idx] = { status: 'rejected', reason: e }; }
    }
  });
  await Promise.all(workers);
  return out;
}

// Anade (deduplicado) el marcador [PLAN 120d] a las observaciones: quita cualquier
// linea previa del marcador para no apilar duplicados en generaciones repetidas.
function marcarPlan(observaciones, fuerte, problema) {
  const base = String(observaciones || '').split('\n').filter((l) => !/^\[PLAN 120d\]/.test(l)).join('\n').trim();
  const linea = `[PLAN 120d] Fuerte: ${fuerte || '-'} | Problema: ${problema || '-'}`;
  return (base ? base + '\n' : '') + linea;
}

// ── Pie legal (LSSI-CE): identificacion del emisor + opcion de baja ──────────
async function getEmisor() {
  const [e] = await sql`SELECT * FROM emisor WHERE id = 1`;
  return e || {};
}
function pieLegal(em) {
  const dir = [em.direccion, [em.cp, em.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const ident = [em.nombre_comercial || em.nombre, dir].filter(Boolean).join(' &middot; ');
  const tel = String(em.telefono || '').trim();
  const WEB = process.env.EMAIL_WEB_URL || 'https://conectanex.es';
  const PRIV = process.env.EMAIL_PRIVACY_URL || (WEB.replace(/\/+$/, '') + '/privacidad');
  const AVISO = process.env.EMAIL_AVISO_URL || (WEB.replace(/\/+$/, '') + '/aviso-legal');
  const contacto = em.email || process.env.AGENCY_EMAIL || 'info.digitalconect@gmail.com';
  return `<hr style="border:0;border-top:1px solid #eee;margin:18px 0">
  <p style="color:#666;font-size:12px;line-height:1.6;margin:0 0 8px">
    <b>${ident}</b><br>
    ${em.email ? `<a href="mailto:${em.email}" style="color:#666;text-decoration:none">${em.email}</a> &middot; ` : ''}${tel ? `Tel: <a href="tel:${tel.replace(/\s+/g, '')}" style="color:#666;text-decoration:none">${tel}</a> &middot; ` : ''}<a href="${WEB}" style="color:#0f7a39">${WEB.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
  </p>
  <p style="color:#999;font-size:11px;line-height:1.6;margin:0">
    Comunicacion comercial. Si no deseas recibir mas correos, responde <b>BAJA</b> y te damos de baja de inmediato.<br>
    <b>Proteccion de datos:</b> responsable del tratamiento ${em.nombre_comercial || em.nombre || 'Conecta Nex'}. Tus datos de contacto, obtenidos de fuentes de acceso publico o profesional, se tratan con la finalidad de presentarte nuestros servicios, sobre la base del interes legitimo (art. 6.1.f RGPD). Puedes ejercer tus derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad escribiendo a <a href="mailto:${contacto}" style="color:#999">${contacto}</a>, y reclamar ante la AEPD. Mas informacion en nuestra <a href="${PRIV}" style="color:#999">Politica de Privacidad</a> y <a href="${AVISO}" style="color:#999">Aviso Legal</a>.
  </p>`;
}
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const LOGO_URL = process.env.EMAIL_LOGO_URL || (BASE_URL + '/logo-email.png');
// Banner del pie del email (imagen optimizada en public/banner-email.png).
const BANNER_URL = process.env.EMAIL_BANNER_URL || (BASE_URL + '/banner-email.png');

// Imagenes INCRUSTADAS (inline) via content_id: se ven aunque el cliente de
// correo bloquee imagenes remotas. Resend las trae desde 'path' y las embebe.
const ADJUNTOS_INLINE = [
  { path: LOGO_URL, filename: 'conecta-nex-logo.png', content_id: 'logo' },
  { path: BANNER_URL, filename: 'conecta-nex-banner.png', content_id: 'banner' },
];
function cabeceraLogo() {
  return `<div style="text-align:center;padding:6px 0 18px"><img src="cid:logo" alt="Conecta Nex" style="max-width:170px;height:auto"></div>`;
}
function bannerPie() {
  if (!BANNER_URL) return '';
  return `<div style="margin-top:18px;text-align:center"><img src="cid:banner" alt="Conecta Nex" style="max-width:100%;height:auto;border-radius:8px"></div>`;
}

// Firma HMAC del enlace de interes (analisis/consulta) para que no se pueda enumerar.
export function firmaInteres(pid, tipo) {
  const key = process.env.CRON_SECRET || process.env.ACCESS_ENCRYPTION_KEY || 'cnx';
  return crypto.createHmac('sha256', key).update(`${pid}:${tipo}`).digest('hex').slice(0, 16);
}

// Botones de accion del email: pedir analisis / consulta gratis (respuesta automatica) y llamar.
function botonesCTA(em, p) {
  const pid = p && p.id ? p.id : '';
  const link = `${BASE_URL}/agendar?p=${pid}`;
  const form = `${BASE_URL}/solicitud?p=${pid}`;
  const tel = String(em.telefono || '').replace(/\s+/g, '');
  const telDisp = String(em.telefono || '').trim();
  const info = `${BASE_URL}/api/interes?p=${pid}&t=info&f=${firmaInteres(pid, 'info')}`;
  const agenda = `${BASE_URL}/agendar?p=${pid}`;
  const btn = (href, txt, bg) => `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin:4px 8px 4px 0">${txt}</a>`;
  return `<div style="margin:20px 0 6px">
    ${pid ? btn(info, 'Quiero información', '#5b3fa0') : ''}
    ${pid ? btn(agenda, 'Quiero agendar cita', '#16a34a') : ''}
  </div>
  <p style="color:#555;font-size:13px;margin:8px 0 0">Reserva tu cita y te llamamos a la hora que elijas, sin compromiso.${telDisp ? ` Si prefieres agilizar, llámanos al <a href="tel:${tel}" style="color:#0f7a39;text-decoration:none"><b>${telDisp}</b></a>.` : ''} O responde a este correo y te contestamos.</p>`;
}

function emailHtml(cuerpo, em, p) {
  const raw = String(cuerpo || '');
  // Si la IA ya devolvio HTML (<p>, <ul>...), se respeta; si es texto plano, se escapa.
  const tieneHtml = /<\w+[^>]*>/.test(raw);
  const body = tieneHtml
    ? raw
    : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto">${cabeceraLogo()}${body}${botonesCTA(em, p)}${pieLegal(em)}${bannerPie()}</div>`;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Generacion del email en frio con IA (Groq) ──────────────────────────────
async function generarFrio(p) {
  const sin = (p.situacion || 'sin_presencia') !== 'mejorable';
  const sys = `Eres el asistente de captacion de Conecta Nex, marca de Digital Conect. El emisor es Lazaro Carrazana. Escribe un email de PRIMER CONTACTO EN FRIO a un negocio, calido y consultivo, que el lector lea entero. NO suena a venta ni a plantilla.
GUION EN ORDEN (parrafos cortos, varios):
1) SALUDO cordial (usa el nombre del contacto si lo hay; si no, "Hola, buenos dias" o similar).
2) INTRODUCCION humana: explica que, buscando por internet, has dado con su negocio. Puedes mencionar su sector y su ciudad de forma natural (la del NEGOCIO, no la tuya).
3) OBSERVACION: ${sin
    ? 'comenta con tacto que apenas tienen presencia online y que, cuando alguien busca su servicio en Google o se lo pregunta a la IA, no aparecen, sin culpabilizar ni alarmar.'
    : 'reconoce que ya tienen algo de presencia online, pero que se puede mejorar para que les encuentren mas y aparezcan cuando la gente busca su servicio.'}
4) PROPUESTA DE VALOR (lo importante): explica con calma que AYUDAMOS A NEGOCIOS A MEJORAR SU PRESENCIA DIGITAL: que aparezcan en Google y en la IA cuando alguien busca su servicio, con web y ficha de Google al dia, buenas resenas y redes cuidadas, para que les encuentren y lleguen mas clientes. Explica el beneficio en su negocio concreto, con ejemplos realistas.
5) CIERRE suave, sin presion: ofrece ensenarselo en una llamada corta o resolver dudas, dejando la puerta abierta.
REGLAS ESTRICTAS:
- Espanol de Espana, profesional, cercano y humano. Tono tranquilo y consultivo, NUNCA agresivo ni con prisa.
- NO digas en que ciudad estamos nosotros ni te describas como "agencia de [ciudad]". Habla de lo que hacemos, no de donde estamos.
- NUNCA uses guion largo (em-dash). Usa guion corto (-) o comas. NO uses emojis.
- NO inventes datos (cifras, nombres de competidores, detalles falsos). NO prometas resultados garantizados ni afirmaciones irreales.
- Nada de formulas vacias ("no dudes en contactarnos", "quedo a tu disposicion", "es un placer").
- Extension: entre 150 y 220 palabras (ni telegrama ni testamento). NO menciones precios.
- NO escribas tu los botones ni enlaces (se anaden aparte). Solo el texto.
Devuelve EXACTAMENTE este formato:
ASUNTO: <asunto corto, honesto, sin clickbait, que invite a abrir>
---
<cuerpo del email en HTML simple usando varios <p>>`;
  const user = `Negocio: ${p.empresa || p.nombre || '(sin nombre)'}. Sector: ${p.sector || '(no indicado)'}. Ciudad: ${p.ciudad || '(no indicada)'}.
Presencia online: ${p.website ? p.website : 'no le hemos encontrado web ni redes'}.
Situacion: ${sin ? 'sin presencia online' : 'presencia mejorable'}.
Observaciones del analisis: ${p.observaciones || '(ninguna)'}.
Persona de contacto: ${p.nombre || '(desconocida)'}.`;
  const { texto } = await llamarIA({
    mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    temperatura: 0.65,
    max_tokens: 900,
  });
  let asunto = '', cuerpo = texto;
  const m = texto.match(/ASUNTO:\s*(.+)/i);
  if (m) { asunto = m[1].trim(); cuerpo = texto.slice(texto.indexOf(m[0]) + m[0].length); }
  cuerpo = cuerpo.replace(/^\s*-{3,}\s*/, '').trim();
  if (!asunto) asunto = sin
    ? `Una idea para dar a conocer ${p.empresa || 'tu negocio'} online`
    : `Una idea para que ${p.empresa || 'tu negocio'} llegue a mas clientes`;
  return { asunto, cuerpo };
}

const ESTADOS = ['nuevo', 'email_enviado', 'respondido', 'convertido', 'descartado'];
const norm = (s) => (s === 'mejorable' ? 'mejorable' : 'sin_presencia');

// Auto-migracion: columnas de prioridad y evolucion + tablas del agente (idempotente, una vez por instancia).
let _migP = false;
async function ensureP() {
  if (_migP) return;
  // Si algun CREATE/ALTER esencial falla (fallo transitorio de BD), NO cacheamos
  // el exito: se reintentara en la siguiente llamada en lugar de servir 500 en frio.
  let ok = true;
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS prioridad text`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS seguimiento_en timestamptz`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interes_grado text`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interes_en timestamptz`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS origen text`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa text`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS etapa_en timestamptz`; } catch { /* noop */ }
  try {
    await sql`CREATE TABLE IF NOT EXISTS captacion_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      activo BOOLEAN DEFAULT FALSE,
      ciudad TEXT DEFAULT '',
      nichos TEXT DEFAULT '',
      limite_diario INTEGER DEFAULT 10,
      nicho_idx INTEGER DEFAULT 0,
      ultima_ejecucion TIMESTAMPTZ,
      ultimo_resultado TEXT DEFAULT '',
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`INSERT INTO captacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  } catch { ok = false; }
  try {
    await sql`CREATE TABLE IF NOT EXISTS prospectos_eventos (
      id SERIAL PRIMARY KEY,
      prospecto_id INTEGER,
      tipo TEXT DEFAULT '',
      detalle TEXT DEFAULT '',
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_peventos_pid ON prospectos_eventos (prospecto_id, creado_en DESC)`;
  } catch { ok = false; }
  _migP = ok;
}

// Historial de evolucion del prospecto (alta, emails, interes, cambios de etapa...).
let _migE = false;
export async function registrarEvento(pid, tipo, detalle) {
  try {
    if (!_migE) {
      await sql`CREATE TABLE IF NOT EXISTS prospectos_eventos (
        id SERIAL PRIMARY KEY,
        prospecto_id INTEGER,
        tipo TEXT DEFAULT '',
        detalle TEXT DEFAULT '',
        creado_en TIMESTAMPTZ DEFAULT NOW()
      )`;
      _migE = true;
    }
    await sql`INSERT INTO prospectos_eventos (prospecto_id, tipo, detalle)
      VALUES (${pid}, ${tipo}, ${String(detalle || '').slice(0, 300)})`;
  } catch { /* el evento es informativo, no bloquea la operacion */ }
}

// Recalcula la ETAPA de evolucion de cada prospecto a partir de sus senales
// (frio -> contactado -> seguimiento -> interesado -> caliente -> cliente) y
// deja constancia de cada transicion en prospectos_eventos.
export async function evolucionarEtapas() {
  await ensureP();
  // Senales externas de "caliente": cita agendada o propuesta aceptada.
  const calientes = new Set();
  const [reg] = await sql`SELECT to_regclass('public.citas') AS citas, to_regclass('public.propuestas') AS propuestas`;
  if (reg && reg.citas) {
    try {
      for (const r of await sql`SELECT DISTINCT prospecto_id FROM citas WHERE prospecto_id IS NOT NULL AND estado IN ('pendiente','confirmada','hecha')`) calientes.add(r.prospecto_id);
    } catch { /* noop */ }
  }
  if (reg && reg.propuestas) {
    try {
      for (const r of await sql`SELECT DISTINCT prospecto_id FROM propuestas WHERE prospecto_id IS NOT NULL AND estado = 'aceptada'`) calientes.add(r.prospecto_id);
    } catch { /* noop */ }
  }
  const cal = [...calientes];
  const cambios = await sql`
    WITH calc AS (
      SELECT p.id, COALESCE(p.etapa, '') AS anterior,
        CASE
          WHEN p.estado = 'convertido' OR p.cliente_id IS NOT NULL THEN 'cliente'
          WHEN p.estado = 'descartado' THEN 'descartado'
          WHEN p.id = ANY(${cal}::int[]) OR p.interes_grado = 'alto' THEN 'caliente'
          WHEN p.estado = 'respondido' AND p.interes_grado = 'bajo' THEN 'contactado'
          WHEN p.estado = 'respondido' OR p.interes_en IS NOT NULL THEN 'interesado'
          WHEN p.estado = 'email_enviado' AND p.seguimiento_en IS NOT NULL THEN 'seguimiento'
          WHEN p.estado = 'email_enviado' THEN 'contactado'
          ELSE 'frio'
        END AS nueva
      FROM prospectos p
    ), upd AS (
      UPDATE prospectos p SET etapa = c.nueva, etapa_en = NOW()
      FROM calc c WHERE c.id = p.id AND c.anterior <> c.nueva
      RETURNING p.id, c.anterior, c.nueva
    )
    INSERT INTO prospectos_eventos (prospecto_id, tipo, detalle)
    SELECT id, 'etapa', CASE WHEN anterior = '' THEN 'Entra en el embudo como ' || nueva ELSE 'Evoluciona: ' || anterior || ' -> ' || nueva END
    FROM upd RETURNING prospecto_id`;
  return cambios.length;
}

// Configuracion del agente de captacion diaria (fila unica id=1).
async function getCaptacion() {
  await ensureP();
  const DEF = { id: 1, activo: false, ciudad: '', nichos: '', limite_diario: 10, nicho_idx: 0 };
  try {
    let [cfg] = await sql`SELECT * FROM captacion_config WHERE id = 1`;
    if (!cfg) {
      await sql`INSERT INTO captacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
      [cfg] = await sql`SELECT * FROM captacion_config WHERE id = 1`;
    }
    return cfg || DEF;
  } catch { return DEF; } // tabla aun no creada (fallo transitorio): valores por defecto, sin 500
}

// Enriquecimiento: busca el email de contacto en la web del negocio.
const EMAIL_RX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const EMAIL_JUNK = ['sentry', 'wixpress', 'example', 'godaddy', 'schema', '.png', '.jpg', '@2x', 'cloudflare', 'wordpress.com'];
async function enriquecerEmailWeb(website) {
  if (!website) return '';
  const url = /^https?:\/\//i.test(website) ? website : 'https://' + website;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
    const txt = (await r.text()).slice(0, 400000);
    for (const e of (txt.match(EMAIL_RX) || [])) {
      const el = e.toLowerCase();
      if (!EMAIL_JUNK.some((j) => el.includes(j))) return e;
    }
  } catch { /* noop */ }
  return '';
}

// La IA puntua la prioridad de contactar a un lead en frio.
async function puntuarLead(p) {
  if (!iaHabilitada()) return null;
  const sys = `Eres analista de captacion de Conecta Nex (marketing para negocios locales). Puntua la PRIORIDAD de contactar a este negocio en frio. Responde EXACTAMENTE en una linea: "PRIORIDAD: Alta|Media|Baja - <motivo en menos de 12 palabras>". Alta = encaja muy bien y hay oportunidad clara; Media = encaje razonable; Baja = poco encaje o faltan datos. Sin emojis ni guion largo.`;
  const user = `Negocio: ${p.empresa || p.nombre || '(s/n)'}. Sector: ${p.sector || '(no indicado)'}. Ciudad: ${p.ciudad || '(no indicada)'}. Presencia: ${p.website ? ('web: ' + p.website) : 'sin web'}. Situacion: ${p.situacion}. Observaciones: ${p.observaciones || '-'}.`;
  try {
    const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.3, max_tokens: 60 });
    const m = String(texto).match(/PRIORIDAD:\s*(Alta|Media|Baja)\s*[-:]?\s*(.*)/i);
    if (m) return { prioridad: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), motivo: (m[2] || '').trim().slice(0, 120) };
    return { prioridad: 'Media', motivo: String(texto).trim().slice(0, 80) };
  } catch { return null; }
}

// Genera el siguiente numero de cliente (CL-AAAA-NNNN), igual que clientes.js.
async function siguienteNumeroCliente() {
  const anio = new Date().getFullYear();
  const [row] = await sql`
    INSERT INTO contadores (clave, valor) VALUES (${'cliente_' + anio}, 1)
    ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW()
    RETURNING valor`;
  return `CL-${anio}-${String(row.valor).padStart(4, '0')}`;
}

// Crea un cliente en el sistema a partir de un prospecto + datos del formulario.
async function convertirEnCliente(p, b) {
  const numero = await siguienteNumeroCliente();
  const notas = `Captado en frio. ${p.sector ? 'Sector: ' + p.sector + '. ' : ''}${p.observaciones ? 'Notas prospeccion: ' + p.observaciones : ''}`.trim();
  const [cli] = await sql`
    INSERT INTO clientes (
      numero_cliente, estado, tipo_persona, nombre, nif, contacto,
      direccion, cp, ciudad, provincia, pais, email, telefono,
      servicios_json, descripcion, plazo, forma_pago, iva,
      base_imponible, iva_importe, total, notas, estado_proyecto, porcentaje_avance
    ) VALUES (
      ${numero}, ${'Pendiente firma'}, ${'Fisica'}, ${b.nombre || p.empresa || p.nombre || 'Cliente'},
      ${(b.nif || '').toUpperCase()}, ${b.contacto || p.nombre || ''},
      ${b.direccion || ''}, ${b.cp || ''}, ${b.ciudad || p.ciudad || ''}, ${'Alicante'}, ${'Espana'},
      ${b.email || p.email || ''}, ${b.telefono || p.telefono || ''},
      ${JSON.stringify([])}::jsonb, ${b.descripcion || ''}, ${''}, ${'50% al inicio, 50% a la entrega'}, ${21},
      ${0}, ${0}, ${0}, ${notas}, ${'Sin iniciar'}, ${0}
    ) RETURNING id, numero_cliente`;
  return cli;
}

// Descubre negocios locales con Bright Data SERP (pack local de Google: nombre/teléfono/web).
async function descubrirBrightData(nicho, zona, limite) {
  const key = process.env.BRIGHTDATA_KEY;
  if (!key) throw new Error('Falta BRIGHTDATA_KEY en el servidor (Vercel).');
  const zone = process.env.BRIGHTDATA_ZONE || 'mcp_unlocker';
  const q = encodeURIComponent(`${nicho} en ${zona}`);
  const url = `https://www.google.com/search?q=${q}&gl=es&hl=es&brd_json=1`;
  const r = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone, url, format: 'raw' }),
  });
  if (!r.ok) throw new Error('Bright Data HTTP ' + r.status);
  let data = await r.json().catch(() => null);
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
  const sp = data && Array.isArray(data.snack_pack) ? data.snack_pack : [];
  const out = [];
  for (const b of sp) {
    const empresa = String(b.name || '').trim();
    if (!empresa) continue;
    out.push({
      empresa,
      telefono: String(b.phone || '').replace(/[^\d+ ]/g, '').trim(),
      website: String(b.site || '').trim(),
    });
    if (out.length >= limite) break;
  }
  return out;
}

// Pipeline completo de captacion: scrapea negocios del nicho en la zona, inserta
// los nuevos (sin duplicar), la IA los prioriza, busca su email en la web y
// redacta el primer contacto en frio. Lo usan 'descubrir' (manual) y 'ciclo_diario' (agente).
async function pipelineDescubrir({ nicho, zona, limite = 12, puntuar = true, enriquecer = true, generar = true, origen = 'descubierto' }) {
  const negocios = await descubrirBrightData(nicho, zona, limite);
  let insertados = 0, duplicados = 0; const nuevosIds = [];
  for (const n of negocios) {
    const existe = await sql`
      SELECT 1 FROM prospectos
      WHERE (website <> '' AND lower(website) = ${n.website.toLowerCase()})
         OR (lower(empresa) = ${n.empresa.toLowerCase()} AND lower(ciudad) = ${zona.toLowerCase()})
      LIMIT 1`;
    if (existe.length) { duplicados++; continue; }
    const [row] = await sql`
      INSERT INTO prospectos (empresa, nombre, email, telefono, sector, ciudad, website, situacion, observaciones, estado, origen, etapa, etapa_en)
      VALUES (${n.empresa}, ${''}, ${''}, ${n.telefono}, ${nicho}, ${zona}, ${n.website},
              ${n.website ? 'mejorable' : 'sin_presencia'}, ${'Descubierto automaticamente (Bright Data).'}, ${'nuevo'}, ${origen}, ${'frio'}, NOW())
      RETURNING id`;
    insertados++; nuevosIds.push(row.id);
    await registrarEvento(row.id, 'alta', `Captado por scrapeo: ${nicho} en ${zona} (lead en frio)`);
  }
  // Puntuar los nuevos con IA (prioridad Alta/Media/Baja). Concurrencia acotada
  // para no chocar con el rate-limit de Groq ni agotar el presupuesto de tiempo.
  let puntuados = 0;
  if (puntuar && iaHabilitada() && nuevosIds.length) {
    const filas = await sql`SELECT * FROM prospectos WHERE id = ANY(${nuevosIds})`;
    const out = await mapLimit(filas, 4, (p) => puntuarLead(p));
    for (let i = 0; i < filas.length; i++) {
      const rr = out[i];
      if (rr.status === 'fulfilled' && rr.value) {
        try {
          await sql`UPDATE prospectos SET prioridad = ${rr.value.prioridad},
            observaciones = ${(filas[i].observaciones ? filas[i].observaciones + '\n' : '') + '[Prioridad IA: ' + rr.value.prioridad + '] ' + rr.value.motivo}
            WHERE id = ${filas[i].id}`;
          puntuados++;
        } catch { /* sigue */ }
      }
    }
  }
  // Enriquecer: buscar el email de contacto en la web de cada nuevo prospecto.
  let enriquecidos = 0;
  if (enriquecer && nuevosIds.length) {
    const conWeb = await sql`SELECT id, website FROM prospectos WHERE id = ANY(${nuevosIds}) AND website <> '' AND (email IS NULL OR email = '')`;
    const mails = await Promise.allSettled(conWeb.map((p) => enriquecerEmailWeb(p.website)));
    for (let i = 0; i < conWeb.length; i++) {
      const rr = mails[i];
      if (rr.status === 'fulfilled' && rr.value) {
        try { await sql`UPDATE prospectos SET email = ${rr.value} WHERE id = ${conWeb[i].id}`; enriquecidos++; } catch { /* sigue */ }
      }
    }
  }
  // Redactar el email de VALOR de cada nuevo prospecto: diagnostico + solucion + plan
  // de 120 dias (redactarPro investiga el negocio). Si la investigacion o la IA fallan,
  // cae al email en frio mas ligero (generarFrio) para no dejar al lead sin borrador.
  let redactados = 0;
  if (generar && iaHabilitada() && nuevosIds.length) {
    const filas = await sql`SELECT * FROM prospectos WHERE id = ANY(${nuevosIds})`;
    const out = await mapLimit(filas, 3, (p) => redactarConValor(p));
    for (let i = 0; i < filas.length; i++) {
      const rr = out[i];
      if (rr.status === 'fulfilled' && rr.value && rr.value.cuerpo) {
        try {
          const obs = rr.value.con_plan ? marcarPlan(filas[i].observaciones, rr.value.fuerte, rr.value.debil) : filas[i].observaciones;
          await sql`UPDATE prospectos SET asunto = ${rr.value.asunto}, email_borrador = ${rr.value.cuerpo}, observaciones = ${obs}, actualizado_en = NOW() WHERE id = ${filas[i].id}`;
          redactados++;
        } catch { /* sigue */ }
      }
    }
  }
  return { descubiertos: negocios.length, insertados, duplicados, puntuados, enriquecidos, redactados };
}

// Investiga un negocio en internet: texto de su web + ficha/reseñas de Google (Bright Data).
export async function investigarNegocio(p) {
  // Web y SERP EN PARALELO (antes eran secuenciales, ~34s por lead).
  const traerWeb = async () => {
    if (!p.website) return '';
    try {
      const url = /^https?:\/\//i.test(p.website) ? p.website : 'https://' + p.website;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
      return (await r.text())
        .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500);
    } catch { return ''; }
  };
  const traerSerp = async () => {
    try {
      const key = process.env.BRIGHTDATA_KEY;
      if (!key) return '';
      const zone = process.env.BRIGHTDATA_ZONE || 'mcp_unlocker';
      const q = encodeURIComponent(`${p.empresa} ${p.ciudad || ''} opiniones`);
      const url = `https://www.google.com/search?q=${q}&gl=es&hl=es&brd_json=1`;
      const rr = await fetch('https://api.brightdata.com/request', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, url, format: 'raw' }), signal: AbortSignal.timeout(22000),
      });
      let data = await rr.json().catch(() => null);
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
      if (!data) return '';
      const sp = (data.snack_pack || [])[0];
      const org = (data.organic || data.organic_results || []).slice(0, 4)
        .map((o) => `${o.title || ''}: ${o.description || o.snippet || ''}`).join(' | ');
      return `${sp ? `Google: ${sp.rating || '?'} estrellas (${sp.reviews_cnt || sp.reviews || '?'} resenas). ` : ''}${org}`.slice(0, 1500);
    } catch { return ''; }
  };
  const [web, serp] = await Promise.all([traerWeb(), traerSerp()]);
  return { web, serp };
}

// Las 4 fases del plan de 120 dias (etiquetas fijas de dias por fase).
const PLAN_DIAS = ['Días 1-30', 'Días 31-60', 'Días 61-90', 'Días 91-120'];
// Plan de respaldo (presencia digital de negocio local) por si la IA no devuelve las fases.
const PLAN_FALLBACK = [
  { titulo: 'Diagnóstico y cimientos', acciones: 'Auditamos tu presencia actual, ponemos a punto (o creamos) tu ficha de Google y tu web con las palabras que busca tu cliente en tu zona.', resuelve: 'Que empieces a aparecer cuando alguien busca tu servicio cerca de ti.' },
  { titulo: 'Reputación y contenido', acciones: 'Activamos un sistema para conseguir reseñas reales, te damos de alta en los directorios que importan y publicamos contenido y fotos que generan confianza.', resuelve: 'Que quien te encuentre confíe y dé el paso de llamarte o escribirte.' },
  { titulo: 'Visibilidad y captación', acciones: 'Trabajamos el SEO local y la aparición en la IA, cuidamos tus redes y, si encaja, lanzamos una captación medida.', resuelve: 'Que más gente te descubra y lleguen más contactos cada semana.' },
  { titulo: 'Medición y escalado', acciones: 'Medimos llamadas y formularios, vemos qué trae clientes de verdad y reforzamos lo que funciona con un plan de continuidad.', resuelve: 'Saber con datos qué te da clientes y multiplicarlo mes a mes.' },
];

// Renderiza el plan de 120 dias (4 fases de 30 dias) como bloque HTML del email.
function renderPlan120(fases, empresa) {
  const COL = ['#0f7a39', '#0c7b6d', '#5b3fa0', '#b8860b'];
  // Escapamos titulo/acciones/resuelve (vienen de la IA) y el nombre de empresa
  // (viene del scrapeo) para que un '<' no rompa el HTML del email.
  const bloques = (fases && fases.length ? fases : PLAN_FALLBACK).slice(0, 4).map((f, i) => `
    <tr><td style="padding:0 0 10px">
      <div style="border-left:4px solid ${COL[i % COL.length]};background:#f6faf7;border-radius:0 10px 10px 0;padding:11px 14px">
        <div style="font-weight:700;color:${COL[i % COL.length]};font-size:14px">${PLAN_DIAS[i]} &middot; ${escHtml(f.titulo)}</div>
        <div style="color:#333;font-size:14px;line-height:1.55;margin-top:4px">${escHtml(f.acciones)}</div>
        ${f.resuelve ? `<div style="color:#555;font-size:13px;line-height:1.5;margin-top:6px"><b>Qué resuelve:</b> ${escHtml(f.resuelve)}</div>` : ''}
      </div>
    </td></tr>`).join('');
  return `<div style="margin:20px 0 8px">
    <div style="font-weight:800;font-size:16px;color:#10151f;margin-bottom:10px">Un plan de 120 días para ${escHtml(empresa || 'tu negocio')}</div>
    <table role="presentation" style="width:100%;border-collapse:collapse">${bloques}</table>
  </div>`;
}

// Agente de VALOR: investiga el negocio, detecta su problema concreto de presencia
// digital, explica la solucion y adjunta un plan de 120 dias (4 fases) con que resuelve
// cada una. Es la propuesta de valor de la agencia, no un email generico.
async function redactarPro(p) {
  const { web, serp } = await investigarNegocio(p);
  const sin = (p.situacion || 'sin_presencia') !== 'mejorable';
  const sys = `Eres consultor de presencia digital de Conecta Nex (marca de Digital Conect); el emisor es Lazaro Carrazana. Te doy informacion REAL de un negocio concreto. NO escribas un email generico: haz un DIAGNOSTICO util y una PROPUESTA con un plan de 120 dias.
Tareas:
1) Detecta UN punto fuerte real y concreto (algo que hacen bien).
2) Detecta EL PROBLEMA principal de su presencia digital (${sin ? 'no tienen web ni apenas presencia, no aparecen cuando buscan su servicio' : 'tienen algo pero mejorable: web anticuada, pocas resenas, no salen arriba en Google ni en la IA'}). Concreto y con tacto, sin culpabilizar.
3) Explica COMO se soluciona y el VALOR que aporta a SU negocio (mas clientes que les encuentran), con realismo.
4) Propon un PLAN DE 120 DIAS en 4 fases de 30 dias. Cada fase: acciones concretas y adaptadas a su sector, y QUE RESUELVE de su problema. Nada de humo ni cifras garantizadas.
REGLAS ESTRICTAS: espanol de Espana, calido y consultivo, sin emojis, sin guion largo (em-dash), sin mencionar precios, sin formulas vacias ("quedo a tu disposicion"). NO INVENTES datos (resenas, cifras, competidores). No escribas botones ni enlaces. Frases claras y breves.
Devuelve EXACTAMENTE este formato (respeta las etiquetas):
FUERTE: <una frase>
PROBLEMA: <una frase concreta>
ASUNTO: <asunto honesto y util, sin clickbait, que mencione la idea de plan o solucion>
INTRO: <2-3 frases: saludo natural, reconoce el punto fuerte y plantea el problema como oportunidad>
SOLUCION: <2-3 frases: como lo solucionamos y el valor concreto para su negocio>
FASE1: <titulo corto> | <acciones concretas dias 1-30> | <que resuelve>
FASE2: <titulo corto> | <acciones concretas dias 31-60> | <que resuelve>
FASE3: <titulo corto> | <acciones concretas dias 61-90> | <que resuelve>
FASE4: <titulo corto> | <acciones concretas dias 91-120> | <que resuelve>
RESULTADO: <1-2 frases: que resolveria en su negocio al terminar los 120 dias, realista>`;
  const user = `Negocio: ${p.empresa || '(s/n)'}. Sector: ${p.sector || '-'}. Ciudad: ${p.ciudad || '-'}. Web: ${p.website || 'no tiene'}.
INFO DE SU WEB: ${web || '(no disponible)'}
INFO DE GOOGLE: ${serp || '(no disponible)'}`;
  const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.6, max_tokens: 1700, timeout_ms: 28000 });

  const campo = (re) => ((texto.match(re) || [])[1] || '').trim();
  const fuerte = campo(/FUERTE:\s*(.+)/i);
  const problema = campo(/PROBLEMA:\s*(.+)/i);
  let asunto = campo(/ASUNTO:\s*(.+)/i);
  const intro = campo(/INTRO:\s*([\s\S]*?)\n\s*SOLUCION:/i) || campo(/INTRO:\s*(.+)/i);
  const solucion = campo(/SOLUCION:\s*([\s\S]*?)\n\s*FASE1:/i) || campo(/SOLUCION:\s*(.+)/i);
  const resultado = campo(/RESULTADO:\s*([\s\S]*)$/i);

  // Parsea las 4 fases "titulo | acciones | que resuelve" (captura multilinea hasta la
  // siguiente etiqueta; el split preserva el resto tras el 2o '|' en 'que resuelve').
  const fases = [];
  let fasesReales = 0;
  for (let i = 1; i <= 4; i++) {
    const bloque = campo(new RegExp(`FASE${i}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:FASE${i + 1}:|RESULTADO:)|$)`, 'i'))
      || campo(new RegExp(`FASE${i}:\\s*(.+)`, 'i'));
    if (bloque) {
      const partes = bloque.split('|');
      const titulo = (partes[0] || '').trim();
      const acciones = (partes[1] || '').replace(/\n+/g, ' ').trim();
      const resuelve = partes.slice(2).join('|').replace(/\n+/g, ' ').trim();
      if (acciones) fasesReales++;
      fases.push({
        titulo: titulo || PLAN_FALLBACK[i - 1].titulo,
        acciones: acciones || PLAN_FALLBACK[i - 1].acciones,
        resuelve: resuelve || PLAN_FALLBACK[i - 1].resuelve,
      });
    } else {
      fases.push(PLAN_FALLBACK[i - 1]);
    }
  }
  // El email es un "plan real" si la IA aporto contenido propio (problema o >=2 fases);
  // si salio todo generico, marcamos con_plan=false para permitir un reintento posterior.
  const conPlan = !!problema || fasesReales >= 2;

  const parr = (s) => escHtml(s).split(/\n{2,}/).filter(Boolean).map((t) => `<p>${t.replace(/\n/g, '<br>')}</p>`).join('');
  const introHtml = intro ? parr(intro) : `<p>Hola, buenos días:</p><p>Buscando por internet di con ${escHtml(p.empresa || 'tu negocio')} y me llamó la atención.</p>`;
  const problemaHtml = problema
    ? `<p style="background:#fff6ec;border-left:4px solid #ea580c;border-radius:0 8px 8px 0;padding:10px 12px;margin:14px 0"><b>Lo que veo:</b> ${escHtml(problema)}</p>`
    : '';
  const solucionHtml = solucion ? parr(solucion) : '';
  const resultadoHtml = resultado
    ? `<p style="background:#f0faf3;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:10px 12px;margin:14px 0"><b>Qué resolvería en tu negocio:</b> ${escHtml(resultado)}</p>`
    : '';
  const cuerpo = `${introHtml}${problemaHtml}${solucionHtml}${renderPlan120(fases, p.empresa)}${resultadoHtml}<p>Si te encaja, te lo explico en una llamada corta y sin compromiso, y te paso este plan por escrito adaptado a tu caso.</p><p>Un saludo,<br>Lázaro &middot; Conecta Nex</p>`;

  if (!asunto) asunto = `Un plan de 120 días para ${p.empresa || 'tu negocio'}`;
  return { asunto, cuerpo, fuerte, debil: problema, con_plan: conPlan };
}

// Email de valor con plan de 120 dias; si la investigacion o la IA fallan, cae al
// email en frio mas ligero para que el lead nunca se quede sin borrador.
async function redactarConValor(p) {
  try {
    const r = await redactarPro(p);
    if (r && r.cuerpo) return r;
  } catch { /* cae al frio */ }
  // El fallback tambien dentro de try: si generarFrio falla (p. ej. rate-limit de Groq),
  // no rechazamos la promesa; devolvemos null y el llamador deja el lead sin borrador
  // (se reintenta en otra pasada) en vez de propagar el error.
  try { return await generarFrio(p); } catch { return null; }
}

export const maxDuration = 60;

export default async function handler(req, res) {
  const auth = checkAuth(req);
  // La automatización (n8n/cron) se autentica con CRON_SECRET en el body, sin el login de la app.
  const cronOk = !!(process.env.CRON_SECRET && req.body && req.body.secret === process.env.CRON_SECRET);
  if (!auth.ok && !cronOk) return jsonResponse(res, 401, { error: auth.error });

  try {
    await ensureP();
    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM prospectos WHERE id = ${req.query.id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });
        if (req.query.eventos) {
          const eventos = await sql`SELECT id, tipo, detalle, creado_en FROM prospectos_eventos WHERE prospecto_id = ${req.query.id} ORDER BY creado_en DESC LIMIT 50`;
          return jsonResponse(res, 200, { ...row, eventos });
        }
        return jsonResponse(res, 200, row);
      }
      const rows = await sql`SELECT * FROM prospectos ORDER BY creado_en DESC`;
      return jsonResponse(res, 200, { prospectos: rows, email_habilitado: emailHabilitado(), ia_habilitada: iaHabilitada() });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const accion = b.accion || 'crear';

      if (accion === 'descubrir') {
        const nicho = String(b.nicho || '').trim();
        const zona = String(b.zona || '').trim();
        if (!nicho || !zona) return jsonResponse(res, 400, { error: 'Faltan nicho y zona' });
        const limite = Math.min(parseInt(b.limite, 10) || 12, 20);
        let r;
        try {
          r = await pipelineDescubrir({
            nicho, zona, limite,
            puntuar: b.puntuar !== false, enriquecer: b.enriquecer !== false, generar: b.generar_emails !== false,
          });
        } catch (e) { return jsonResponse(res, 502, { error: e.message }); }
        return jsonResponse(res, 200, { ok: true, ...r });
      }

      // ── Agente de captacion diaria ─────────────────────────────────────────
      // Configuracion del scrapeo (ciudad + nichos que rotan + limite + activo).
      if (accion === 'config_get') {
        return jsonResponse(res, 200, await getCaptacion());
      }
      if (accion === 'config_set') {
        await getCaptacion(); // asegura tabla y fila
        const [row] = await sql`UPDATE captacion_config SET
          activo = ${!!b.activo},
          ciudad = ${String(b.ciudad || '').trim()},
          nichos = ${String(b.nichos || '').trim()},
          limite_diario = ${Math.min(Math.max(parseInt(b.limite_diario, 10) || 10, 1), 20)},
          actualizado_en = NOW()
          WHERE id = 1 RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      // Ciclo del agente: cada dia scrapea la ciudad configurada con el nicho que
      // toque (rotan), mete los nuevos leads EN FRIO, la IA los prioriza, busca su
      // email, redacta el primer contacto y recalcula la evolucion del embudo.
      if (accion === 'ciclo_diario') {
        const cfg = await getCaptacion();
        if (!cfg.activo && !b.forzar) return jsonResponse(res, 200, { ok: true, saltado: 'agente desactivado' });
        const ciudad = String(b.ciudad || cfg.ciudad || '').trim();
        const nichos = String(cfg.nichos || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        if (!ciudad) return jsonResponse(res, 400, { error: 'Configura la ciudad del agente de captacion.' });
        if (!nichos.length) return jsonResponse(res, 400, { error: 'Configura al menos un nicho (sector) a buscar.' });
        const idx = ((cfg.nicho_idx || 0) % nichos.length + nichos.length) % nichos.length;
        const nicho = nichos[idx];
        let r = null, err = '';
        try {
          r = await pipelineDescubrir({ nicho, zona: ciudad, limite: Math.min(cfg.limite_diario || 10, 20), origen: 'agente_diario' });
        } catch (e) { err = e.message; }
        const evolucionados = await evolucionarEtapas().catch(() => 0);
        const resumen = err
          ? `ERROR (${nicho} en ${ciudad}): ${err}`
          : `${nicho} en ${ciudad}: ${r.insertados} nuevos en frio (${r.duplicados} repetidos), ${r.enriquecidos} emails encontrados, ${r.redactados} borradores IA`;
        // Solo avanzamos al siguiente nicho si el scrapeo funciono; si fallo (p. ej.
        // Bright Data caido), se reintenta el MISMO nicho en la proxima ejecucion.
        const siguienteIdx = err ? (cfg.nicho_idx || 0) : (cfg.nicho_idx || 0) + 1;
        await sql`UPDATE captacion_config SET nicho_idx = ${siguienteIdx},
          ultima_ejecucion = NOW(), ultimo_resultado = ${resumen.slice(0, 500)}, actualizado_en = NOW() WHERE id = 1`;
        if (err) return jsonResponse(res, 502, { error: err, nicho, ciudad });
        return jsonResponse(res, 200, { ok: true, nicho, ciudad, ...r, evolucionados });
      }

      // Recalcula la etapa de evolucion de todos los prospectos.
      if (accion === 'evolucionar') {
        const cambios = await evolucionarEtapas();
        return jsonResponse(res, 200, { ok: true, cambios });
      }

      // Panel de evolucion: recalcula etapas y devuelve el embudo + actividad reciente.
      if (accion === 'evolucion') {
        const cambios = await evolucionarEtapas().catch(() => 0);
        const etapas = await sql`SELECT COALESCE(NULLIF(etapa, ''), 'frio') AS etapa, COUNT(*)::int AS n FROM prospectos GROUP BY 1`;
        const ciudades = await sql`
          SELECT COALESCE(NULLIF(ciudad, ''), '(sin ciudad)') AS ciudad, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE etapa IN ('interesado','caliente'))::int AS interesados,
            COUNT(*) FILTER (WHERE etapa = 'cliente')::int AS clientes
          FROM prospectos GROUP BY 1 ORDER BY 2 DESC LIMIT 12`;
        const eventos = await sql`
          SELECT e.id, e.prospecto_id, e.tipo, e.detalle, e.creado_en, p.empresa
          FROM prospectos_eventos e LEFT JOIN prospectos p ON p.id = e.prospecto_id
          ORDER BY e.creado_en DESC LIMIT 40`;
        return jsonResponse(res, 200, { ok: true, cambios, etapas, ciudades, eventos });
      }

      if (accion === 'crear') {
        const [row] = await sql`
          INSERT INTO prospectos (empresa, nombre, email, telefono, sector, ciudad, website, situacion, observaciones)
          VALUES (${b.empresa || ''}, ${b.nombre || ''}, ${b.email || ''}, ${b.telefono || ''}, ${b.sector || ''},
                  ${b.ciudad || ''}, ${b.website || ''}, ${norm(b.situacion)}, ${b.observaciones || ''})
          RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      if (accion === 'importar') {
        const filas = Array.isArray(b.filas) ? b.filas : [];
        let n = 0;
        for (const f of filas.slice(0, 2000)) {
          const empresa = String(f.empresa || f.nombre || '').trim();
          const email = String(f.email || '').trim();
          if (!empresa && !email) continue;
          const web = String(f.website || '').trim();
          await sql`
            INSERT INTO prospectos (empresa, nombre, email, telefono, sector, ciudad, website, situacion, observaciones)
            VALUES (${empresa}, ${String(f.contacto || '').trim()}, ${email}, ${String(f.telefono || '').trim()},
                    ${String(f.sector || '').trim()}, ${String(f.ciudad || '').trim()}, ${web},
                    ${web ? 'mejorable' : 'sin_presencia'}, ${String(f.observaciones || '').trim()})`;
          n++;
        }
        return jsonResponse(res, 200, { importados: n });
      }

      if (accion === 'generar') {
        if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${b.id}`;
        if (!p) return jsonResponse(res, 404, { error: 'No encontrado' });
        // Email en frio ligero solo si se pide expresamente (rapido:true); por defecto,
        // el email de VALOR con diagnostico + solucion + plan de 120 dias.
        const r = b.rapido ? await generarFrio({ ...p, ...b }) : await redactarConValor({ ...p, ...b });
        if (!r || !r.cuerpo) return jsonResponse(res, 502, { error: 'La IA no pudo redactar ahora (reintenta en un momento).' });
        const obs = r.con_plan ? marcarPlan(p.observaciones, r.fuerte, r.debil) : p.observaciones;
        const [row] = await sql`UPDATE prospectos SET asunto = ${r.asunto}, email_borrador = ${r.cuerpo}, observaciones = ${obs}, actualizado_en = NOW() WHERE id = ${b.id} RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      // Redacta en lote el email de los prospectos que aun no tienen borrador (prioriza los de Prioridad Alta).
      if (accion === 'generar_pendientes') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const limite = Math.min(parseInt(b.limite, 10) || 10, 15);
        const filas = await sql`
          SELECT * FROM prospectos
          WHERE (email_borrador IS NULL OR email_borrador = '') AND estado = 'nuevo'
          ORDER BY (prioridad = 'Alta') DESC NULLS LAST, creado_en ASC
          LIMIT ${limite}`;
        const out = await Promise.allSettled(filas.map((p) => generarFrio(p)));
        let redactados = 0;
        for (let i = 0; i < filas.length; i++) {
          const rr = out[i];
          if (rr.status === 'fulfilled' && rr.value && rr.value.cuerpo) {
            try {
              await sql`UPDATE prospectos SET asunto = ${rr.value.asunto}, email_borrador = ${rr.value.cuerpo}, actualizado_en = NOW() WHERE id = ${filas[i].id}`;
              redactados++;
            } catch { /* sigue */ }
          }
        }
        const [{ pendientes }] = await sql`
          SELECT COUNT(*)::int AS pendientes FROM prospectos
          WHERE (email_borrador IS NULL OR email_borrador = '') AND estado = 'nuevo'`;
        return jsonResponse(res, 200, { ok: true, redactados, pendientes });
      }

      // Enriquecimiento en lote: rellena el email de prospectos con web pero sin email.
      if (accion === 'enriquecer') {
        const limite = Math.min(parseInt(b.limite, 10) || 15, 30);
        const filas = await sql`SELECT id, website FROM prospectos WHERE website <> '' AND (email IS NULL OR email = '') LIMIT ${limite}`;
        const mails = await Promise.allSettled(filas.map((p) => enriquecerEmailWeb(p.website)));
        let enriquecidos = 0;
        for (let i = 0; i < filas.length; i++) {
          const rr = mails[i];
          if (rr.status === 'fulfilled' && rr.value) {
            try { await sql`UPDATE prospectos SET email = ${rr.value} WHERE id = ${filas[i].id}`; enriquecidos++; } catch { /* sigue */ }
          }
        }
        const [{ pendientes }] = await sql`SELECT COUNT(*)::int AS pendientes FROM prospectos WHERE website <> '' AND (email IS NULL OR email = '')`;
        return jsonResponse(res, 200, { ok: true, enriquecidos, pendientes });
      }

      // Secuencia de seguimiento: redacta un follow-up para los que recibieron email y no han respondido.
      if (accion === 'seguimientos') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
        const dias = Math.max(1, parseInt(b.dias, 10) || 4);
        const limite = Math.min(parseInt(b.limite, 10) || 10, 15);
        const filas = await sql`
          SELECT * FROM prospectos
          WHERE estado = 'email_enviado'
            AND enviado_en IS NOT NULL AND enviado_en < NOW() - (${dias} * INTERVAL '1 day')
            AND (seguimiento_en IS NULL OR seguimiento_en < NOW() - INTERVAL '6 days')
          ORDER BY enviado_en ASC LIMIT ${limite}`;
        let redactados = 0;
        for (const p of filas) {
          try {
            const sys = `Eres el asistente de Conecta Nex. Escribe un SEGUIMIENTO breve y cordial a un negocio al que ya escribimos hace unos dias y no ha respondido. Espanol de Espana, sin presion, sin emojis, sin guion largo. Recuerda con tacto el correo anterior, aporta un motivo util para responder y deja la puerta abierta. 60-110 palabras. Devuelve EXACTAMENTE: "ASUNTO: <asunto>" en la primera linea, luego "---", luego el cuerpo en HTML con <p>.`;
            const user = `Negocio: ${p.empresa || '(s/n)'}. Sector: ${p.sector || '-'}. Ciudad: ${p.ciudad || '-'}. Asunto del email anterior: ${p.asunto || '-'}.`;
            const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.6, max_tokens: 500 });
            let asunto = '', cuerpo = texto;
            const m = texto.match(/ASUNTO:\s*(.+)/i);
            if (m) { asunto = m[1].trim(); cuerpo = texto.slice(texto.indexOf(m[0]) + m[0].length); }
            cuerpo = cuerpo.replace(/^\s*-{3,}\s*/, '').trim();
            if (!asunto) asunto = 'Re: ' + String(p.asunto || 'nuestro mensaje').replace(/^\s*Re:\s*/i, '');
            await sql`UPDATE prospectos SET asunto = ${asunto}, email_borrador = ${cuerpo}, seguimiento_en = NOW(), actualizado_en = NOW() WHERE id = ${p.id}`;
            await registrarEvento(p.id, 'seguimiento', 'Follow-up redactado por la IA: ' + asunto);
            redactados++;
          } catch { /* sigue */ }
        }
        return jsonResponse(res, 200, { ok: true, redactados });
      }

      // Resumen del embudo de captacion (panel premium).
      if (accion === 'resumen') {
        const [r] = await sql`SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE estado='nuevo')::int AS nuevos,
          COUNT(*) FILTER (WHERE estado='email_enviado')::int AS enviados,
          COUNT(*) FILTER (WHERE estado='respondido')::int AS respondidos,
          COUNT(*) FILTER (WHERE estado='convertido')::int AS convertidos,
          COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS con_email,
          COUNT(*) FILTER (WHERE prioridad='Alta')::int AS prioridad_alta,
          COUNT(*) FILTER (WHERE email_borrador IS NOT NULL AND email_borrador <> '')::int AS con_borrador
          FROM prospectos`;
        return jsonResponse(res, 200, { ok: true, ...r });
      }

      // Agente de valor: investiga cada negocio y redacta el email con diagnostico,
      // solucion y plan de 120 dias. Salta los que ya tienen el plan redactado.
      if (accion === 'redactar_pro') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
        const limite = Math.min(parseInt(b.limite, 10) || 4, 6);
        const filas = b.id
          ? await sql`SELECT * FROM prospectos WHERE id = ${b.id}`
          : await sql`
              SELECT * FROM prospectos
              WHERE estado = 'nuevo' AND (observaciones IS NULL OR observaciones NOT LIKE '%[PLAN 120d]%')
              ORDER BY (prioridad = 'Alta') DESC NULLS LAST, creado_en ASC
              LIMIT ${limite}`;
        // redactarConValor garantiza borrador (cae a frio) y nunca lanza; concurrencia acotada.
        const res2 = await mapLimit(filas, 3, async (p) => {
          const r = await redactarConValor(p);
          if (!r || !r.cuerpo) return false;
          const obs = marcarPlan(p.observaciones, r.fuerte, r.debil);
          await sql`UPDATE prospectos SET asunto = ${r.asunto}, email_borrador = ${r.cuerpo}, observaciones = ${obs}, actualizado_en = NOW() WHERE id = ${p.id}`;
          return true;
        });
        const redactados = res2.filter((x) => x.status === 'fulfilled' && x.value).length;
        const [{ pendientes }] = await sql`
          SELECT COUNT(*)::int AS pendientes FROM prospectos
          WHERE estado = 'nuevo' AND (observaciones IS NULL OR observaciones NOT LIKE '%[PLAN 120d]%')`;
        return jsonResponse(res, 200, { ok: true, redactados, pendientes });
      }

      // Auto-envio: la IA envia sola a los de mayor probabilidad (Prioridad Alta) que ya tienen email + borrador.
      // Los pasa a estado 'email_enviado' (= Contactados). Lote pequeno por entregabilidad (anti-spam).
      if (accion === 'enviar_auto') {
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado.' });
        const limite = Math.min(parseInt(b.limite, 10) || 5, 10);
        // Ventana de revision: no auto-enviar a leads recien captados (por defecto 2h).
        // Evita mandar un correo si el email extraido de la web es erroneo o no procede.
        // Distinguimos NaN (no indicado -> 2h) de 0 (envio inmediato explicito).
        const mh = parseInt(b.min_horas, 10);
        const minHoras = Number.isNaN(mh) ? 2 : Math.max(0, mh);
        const em = await getEmisor();
        const filas = await sql`
          SELECT * FROM prospectos
          WHERE estado = 'nuevo'
            AND email IS NOT NULL AND email <> ''
            AND email_borrador IS NOT NULL AND email_borrador <> ''
            AND creado_en < NOW() - (${minHoras} * INTERVAL '1 hour')
          ORDER BY (prioridad = 'Alta') DESC NULLS LAST, creado_en ASC
          LIMIT ${limite}`;
        let enviados = 0;
        for (const p of filas) {
          if (!RE_EMAIL.test(String(p.email || ''))) continue;
          try {
            await enviarEmail({
              to: p.email,
              subject: p.asunto || `Una idea para ${p.empresa || 'tu negocio'}`,
              html: emailHtml(p.email_borrador, em, p),
              replyTo: process.env.REPLY_TO_EMAIL,
              attachments: ADJUNTOS_INLINE,
            });
            await sql`UPDATE prospectos SET estado = 'email_enviado', enviado_en = NOW(), actualizado_en = NOW() WHERE id = ${p.id}`;
            await registrarEvento(p.id, 'email', 'Email en frio enviado (auto): ' + (p.asunto || ''));
            enviados++;
          } catch (e) { console.error('enviar_auto:', e.message); }
        }
        // El contador refleja los que REALMENTE se pueden auto-enviar: misma ventana de
        // revision y formato de email valido que la SELECT de envio.
        const [{ pendientes }] = await sql`
          SELECT COUNT(*)::int AS pendientes FROM prospectos
          WHERE estado = 'nuevo' AND email <> '' AND email_borrador <> ''
            AND creado_en < NOW() - (${minHoras} * INTERVAL '1 hour')
            AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]{2,}$'`;
        return jsonResponse(res, 200, { ok: true, enviados, pendientes });
      }

      if (accion === 'enviar') {
        if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado (RESEND_API_KEY y RESEND_FROM_EMAIL).' });
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${b.id}`;
        if (!p) return jsonResponse(res, 404, { error: 'No encontrado' });
        const asunto = b.asunto != null ? b.asunto : p.asunto;
        const cuerpo = b.email_borrador != null ? b.email_borrador : p.email_borrador;
        if (!RE_EMAIL.test(String(p.email || ''))) return jsonResponse(res, 400, { error: 'El prospecto no tiene un email valido.' });
        if (!cuerpo || !String(cuerpo).trim()) return jsonResponse(res, 400, { error: 'No hay email redactado. Genera o escribe el cuerpo primero.' });
        const em = await getEmisor();
        await enviarEmail({ to: p.email, subject: asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(cuerpo, em, p), replyTo: process.env.REPLY_TO_EMAIL, attachments: ADJUNTOS_INLINE });
        const [row] = await sql`UPDATE prospectos SET asunto = ${asunto || ''}, email_borrador = ${cuerpo}, estado = 'email_enviado', enviado_en = NOW(), actualizado_en = NOW() WHERE id = ${b.id} RETURNING *`;
        await registrarEvento(b.id, 'email', 'Email enviado: ' + (asunto || ''));
        return jsonResponse(res, 200, row);
      }

      if (accion === 'puntuar_todos') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const pend = await sql`SELECT * FROM prospectos WHERE (prioridad IS NULL OR prioridad = '') ORDER BY creado_en DESC LIMIT 20`;
        let n = 0;
        for (const p of pend) {
          try {
            const r = await puntuarLead(p);
            if (r) {
              const obs = p.observaciones ? p.observaciones + '\n' : '';
              await sql`UPDATE prospectos SET prioridad = ${r.prioridad}, observaciones = ${obs + '[Prioridad IA: ' + r.prioridad + '] ' + r.motivo}, actualizado_en = NOW() WHERE id = ${p.id}`;
              n++;
            }
          } catch { /* sigue */ }
        }
        return jsonResponse(res, 200, { puntuados: n });
      }

      if (accion === 'generar_todos') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const pend = await sql`SELECT * FROM prospectos WHERE (email_borrador IS NULL OR email_borrador = '') ORDER BY creado_en DESC LIMIT 15`;
        let n = 0;
        for (const p of pend) {
          try {
            const r = await generarFrio(p);
            await sql`UPDATE prospectos SET asunto = ${r.asunto}, email_borrador = ${r.cuerpo}, actualizado_en = NOW() WHERE id = ${p.id}`;
            n++;
          } catch { /* sigue con el siguiente */ }
        }
        return jsonResponse(res, 200, { generados: n });
      }

      if (accion === 'enviar_todos') {
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado (RESEND).' });
        const em = await getEmisor();
        const pend = await sql`SELECT * FROM prospectos WHERE estado != 'email_enviado' AND email_borrador IS NOT NULL AND email_borrador != '' AND email IS NOT NULL AND email != '' ORDER BY creado_en ASC LIMIT 40`;
        let ok = 0;
        for (const p of pend) {
          if (!RE_EMAIL.test(String(p.email || ''))) continue;
          try {
            await enviarEmail({ to: p.email, subject: p.asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(p.email_borrador, em, p), replyTo: process.env.REPLY_TO_EMAIL, attachments: ADJUNTOS_INLINE });
            await sql`UPDATE prospectos SET estado = 'email_enviado', enviado_en = NOW(), actualizado_en = NOW() WHERE id = ${p.id}`;
            await registrarEvento(p.id, 'email', 'Email en frio enviado (lote): ' + (p.asunto || ''));
            ok++;
          } catch { /* sigue */ }
        }
        return jsonResponse(res, 200, { enviados: ok, total: pend.length });
      }

      if (accion === 'email_prueba') {
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado (RESEND_API_KEY y RESEND_FROM_EMAIL).' });
        const to = (b.email && RE_EMAIL.test(String(b.email))) ? String(b.email).trim() : (process.env.AGENCY_EMAIL || '');
        if (!RE_EMAIL.test(to)) return jsonResponse(res, 400, { error: 'Indica un email de destino valido.' });
        const em = await getEmisor();
        const cuerpo = `<p>Hola, buenos dias:</p>
<p>Este es un email de PRUEBA para que veas como se ve el correo que reciben los prospectos.</p>
<p>Buscando por internet di con tu negocio y me llamo la atencion. En Conecta Nex ayudamos a negocios a MEJORAR SU PRESENCIA DIGITAL: que aparezcan en Google y en la IA cuando alguien busca su servicio, con web y ficha de Google al dia, buenas resenas y redes cuidadas, para que les encuentren y lleguen mas clientes.</p>
<p>Si te apetece, te lo enseno en una llamada corta y sin compromiso. Un saludo, Lazaro.</p>`;
        await enviarEmail({ to, subject: '[PRUEBA] Asi se ve tu email de captacion - Conecta Nex', html: emailHtml(cuerpo, em, { id: 999999999 }), replyTo: process.env.REPLY_TO_EMAIL, attachments: ADJUNTOS_INLINE });
        return jsonResponse(res, 200, { ok: true, to });
      }

      if (accion === 'convertir') {
        if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!b.nif || !String(b.nif).trim()) return jsonResponse(res, 400, { error: 'El NIF/CIF es obligatorio para crear el cliente.' });
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${b.id}`;
        if (!p) return jsonResponse(res, 404, { error: 'Prospecto no encontrado' });
        if (p.cliente_id) return jsonResponse(res, 400, { error: 'Este prospecto ya es cliente.' });
        const cli = await convertirEnCliente(p, b);
        await sql`UPDATE prospectos SET estado = 'convertido', cliente_id = ${cli.id}, etapa = 'cliente', etapa_en = NOW(), actualizado_en = NOW() WHERE id = ${b.id}`;
        await registrarEvento(b.id, 'convertido', 'Convertido en cliente ' + cli.numero_cliente);
        return jsonResponse(res, 200, { cliente_id: cli.id, numero_cliente: cli.numero_cliente });
      }

      if (accion === 'borrar_varios') {
        const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => parseInt(x, 10)).filter(Boolean);
        if (!ids.length) return jsonResponse(res, 400, { error: 'No hay ids que borrar' });
        await sql`DELETE FROM prospectos WHERE id = ANY(${ids})`;
        return jsonResponse(res, 200, { borrados: ids.length });
      }

      if (accion === 'vaciar') {
        // Borra TODOS los prospectos, o solo los de un estado si se indica.
        if (b.estado && ESTADOS.includes(b.estado)) {
          const r = await sql`DELETE FROM prospectos WHERE estado = ${b.estado} RETURNING id`;
          return jsonResponse(res, 200, { borrados: r.length });
        }
        const r = await sql`DELETE FROM prospectos RETURNING id`;
        return jsonResponse(res, 200, { borrados: r.length });
      }

      return jsonResponse(res, 400, { error: 'Accion no valida' });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE prospectos SET
          empresa = ${b.empresa || ''}, nombre = ${b.nombre || ''}, email = ${b.email || ''},
          telefono = ${b.telefono || ''}, sector = ${b.sector || ''}, ciudad = ${b.ciudad || ''},
          website = ${b.website || ''}, situacion = ${norm(b.situacion)}, observaciones = ${b.observaciones || ''},
          asunto = ${b.asunto || ''}, email_borrador = ${b.email_borrador || ''},
          estado = ${ESTADOS.includes(b.estado) ? b.estado : 'nuevo'}, actualizado_en = NOW()
        WHERE id = ${b.id} RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM prospectos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
