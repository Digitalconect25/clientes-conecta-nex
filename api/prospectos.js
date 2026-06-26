import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import crypto from 'node:crypto';

// ── Pie legal (LSSI-CE): identificacion del emisor + opcion de baja ──────────
async function getEmisor() {
  const [e] = await sql`SELECT * FROM emisor WHERE id = 1`;
  return e || {};
}
function pieLegal(em) {
  const dir = [em.direccion, [em.cp, em.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const ident = [em.nombre, dir, em.email].filter(Boolean).join(' &middot; ');
  return `<hr style="border:0;border-top:1px solid #eee;margin:18px 0">
  <p style="color:#888;font-size:12px">${ident}<br>Comunicacion comercial. Si no deseas recibir mas correos, responde con la palabra <b>BAJA</b> y te damos de baja de inmediato.</p>`;
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
  const analisis = `${BASE_URL}/api/interes?p=${pid}&t=analisis&f=${firmaInteres(pid, 'analisis')}`;
  const consulta = `${BASE_URL}/api/interes?p=${pid}&t=consulta&f=${firmaInteres(pid, 'consulta')}`;
  const btn = (href, txt, bg) => `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin:4px 8px 4px 0">${txt}</a>`;
  return `<div style="margin:20px 0 6px">
    ${pid ? btn(analisis, 'Quiero mi análisis gratis', '#5b3fa0') : ''}
    ${pid ? btn(consulta, 'Quiero una consulta gratuita', '#16a34a') : ''}
    ${tel ? btn('tel:' + tel, 'Llamar ahora', '#0f7a39') : ''}
  </div>
  <p style="color:#555;font-size:13px;margin:6px 0 0">O simplemente responde a este correo y te contestamos.</p>`;
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
    ? 'comenta con tacto que apenas tienen presencia online y, sobre todo, que probablemente no tienen una forma de mantener el contacto con sus clientes para que vuelvan, sin culpabilizar ni alarmar.'
    : 'reconoce que ya tienen algo de presencia, y enfoca en que captar clientes esta bien pero el mayor valor esta en mantenerlos y hacer que vuelvan.'}
4) PROPUESTA DE VALOR (lo importante): explica con calma como les ayudamos a fidelizar y vender mas a sus clientes actuales con email marketing: boletines y newsletters con plantillas de diseno profesional, campanas automatizadas (felicitaciones, recordatorios, ofertas en el momento justo) y segmentos creados con inteligencia artificial para enviar el mensaje adecuado a cada tipo de cliente. Explica el beneficio en su negocio concreto, con ejemplos realistas.
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

// Auto-migracion: columna de prioridad (idempotente, una vez por instancia).
let _migP = false;
async function ensureP() {
  if (_migP) return;
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS prioridad text`; } catch { /* noop */ }
  try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS seguimiento_en timestamptz`; } catch { /* noop */ }
  _migP = true;
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

// Investiga un negocio en internet: texto de su web + ficha/reseñas de Google (Bright Data).
async function investigarNegocio(p) {
  let web = '', serp = '';
  if (p.website) {
    try {
      const url = /^https?:\/\//i.test(p.website) ? p.website : 'https://' + p.website;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
      web = (await r.text())
        .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500);
    } catch { /* noop */ }
  }
  try {
    const key = process.env.BRIGHTDATA_KEY;
    if (key) {
      const zone = process.env.BRIGHTDATA_ZONE || 'mcp_unlocker';
      const q = encodeURIComponent(`${p.empresa} ${p.ciudad || ''} opiniones`);
      const url = `https://www.google.com/search?q=${q}&gl=es&hl=es&brd_json=1`;
      const rr = await fetch('https://api.brightdata.com/request', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, url, format: 'raw' }), signal: AbortSignal.timeout(22000),
      });
      let data = await rr.json().catch(() => null);
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
      if (data) {
        const sp = (data.snack_pack || [])[0];
        const org = (data.organic || data.organic_results || []).slice(0, 4)
          .map((o) => `${o.title || ''}: ${o.description || o.snippet || ''}`).join(' | ');
        serp = `${sp ? `Google: ${sp.rating || '?'} estrellas (${sp.reviews_cnt || sp.reviews || '?'} resenas). ` : ''}${org}`.slice(0, 1500);
      }
    }
  } catch { /* noop */ }
  return { web, serp };
}

// Agente PRO: investiga el negocio, saca punto fuerte y debil, y redacta un email PERSONALIZADO.
async function redactarPro(p) {
  const { web, serp } = await investigarNegocio(p);
  const sys = `Eres el asistente de captacion de Conecta Nex; el emisor es Lazaro Carrazana. Te doy informacion REAL de un negocio concreto. Tu tarea:
1) Identifica UN punto fuerte real y concreto (algo que hacen bien: producto, trato, trayectoria, buenas resenas) y UN punto debil u oportunidad, sobre todo de presencia online (sin web, sin resenas, no aparece en Google ni en la IA, web anticuada, no fideliza a sus clientes).
2) Escribe un email de PRIMER CONTACTO personalizado para ESE negocio: modesto, amable y honesto, SIN vender humo ni exagerar ni prometer resultados. Reconoce con sinceridad el punto fuerte (concreto, no generico), plantea con tacto el punto debil como oportunidad, y ofrece ayuda sin presion (ensenarselo en una llamada corta).
REGLAS: espanol de Espana, calido y consultivo, sin emojis, sin guion largo (em-dash), 120-180 palabras, sin mencionar precios, sin formulas vacias. NO INVENTES datos: si no sabes algo, no lo afirmes. No escribas botones ni enlaces.
Devuelve EXACTAMENTE este formato:
FUERTE: <una frase>
DEBIL: <una frase>
ASUNTO: <asunto honesto, sin clickbait>
---
<cuerpo del email en HTML simple con varios <p>>`;
  const user = `Negocio: ${p.empresa || '(s/n)'}. Sector: ${p.sector || '-'}. Ciudad: ${p.ciudad || '-'}. Web: ${p.website || 'no tiene'}.
INFO DE SU WEB: ${web || '(no disponible)'}
INFO DE GOOGLE: ${serp || '(no disponible)'}`;
  const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.6, max_tokens: 950 });
  const fuerte = ((texto.match(/FUERTE:\s*(.+)/i) || [])[1] || '').trim();
  const debil = ((texto.match(/DEBIL:\s*(.+)/i) || [])[1] || '').trim();
  let asunto = ((texto.match(/ASUNTO:\s*(.+)/i) || [])[1] || '').trim();
  let cuerpo = texto;
  const idx = texto.indexOf('---');
  if (idx >= 0) cuerpo = texto.slice(idx + 3);
  else { const ma = texto.match(/ASUNTO:.*/i); if (ma) cuerpo = texto.slice(texto.indexOf(ma[0]) + ma[0].length); }
  cuerpo = cuerpo.replace(/^\s*-{3,}\s*/, '').trim();
  if (!asunto) asunto = `Una idea para ${p.empresa || 'tu negocio'}`;
  return { asunto, cuerpo, fuerte, debil };
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
        let negocios;
        try { negocios = await descubrirBrightData(nicho, zona, limite); }
        catch (e) { return jsonResponse(res, 502, { error: e.message }); }
        let insertados = 0, duplicados = 0; const nuevosIds = [];
        for (const n of negocios) {
          const existe = await sql`
            SELECT 1 FROM prospectos
            WHERE (website <> '' AND lower(website) = ${n.website.toLowerCase()})
               OR (lower(empresa) = ${n.empresa.toLowerCase()} AND lower(ciudad) = ${zona.toLowerCase()})
            LIMIT 1`;
          if (existe.length) { duplicados++; continue; }
          const [row] = await sql`
            INSERT INTO prospectos (empresa, nombre, email, telefono, sector, ciudad, website, situacion, observaciones, estado, origen)
            VALUES (${n.empresa}, ${''}, ${''}, ${n.telefono}, ${nicho}, ${zona}, ${n.website},
                    ${n.website ? 'mejorable' : 'sin_presencia'}, ${'Descubierto automaticamente (Bright Data).'}, ${'nuevo'}, ${'descubierto'})
            RETURNING id`;
          insertados++; nuevosIds.push(row.id);
        }
        // Auto-puntuar los nuevos (en paralelo, acotado) salvo que se pida puntuar:false
        let puntuados = 0;
        if (b.puntuar !== false && iaHabilitada() && nuevosIds.length) {
          const filas = await sql`SELECT * FROM prospectos WHERE id = ANY(${nuevosIds})`;
          const out = await Promise.allSettled(filas.map((p) => puntuarLead(p)));
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
        // Enriquecer: buscar el email de contacto en la web de cada nuevo prospecto (salvo enriquecer:false).
        let enriquecidos = 0;
        if (b.enriquecer !== false && nuevosIds.length) {
          const conWeb = await sql`SELECT id, website FROM prospectos WHERE id = ANY(${nuevosIds}) AND website <> '' AND (email IS NULL OR email = '')`;
          const mails = await Promise.allSettled(conWeb.map((p) => enriquecerEmailWeb(p.website)));
          for (let i = 0; i < conWeb.length; i++) {
            const rr = mails[i];
            if (rr.status === 'fulfilled' && rr.value) {
              try { await sql`UPDATE prospectos SET email = ${rr.value} WHERE id = ${conWeb[i].id}`; enriquecidos++; } catch { /* sigue */ }
            }
          }
        }
        // Auto-redactar el email en frio de cada nuevo prospecto (salvo generar_emails:false).
        let redactados = 0;
        if (b.generar_emails !== false && iaHabilitada() && nuevosIds.length) {
          const filas = await sql`SELECT * FROM prospectos WHERE id = ANY(${nuevosIds})`;
          const out = await Promise.allSettled(filas.map((p) => generarFrio(p)));
          for (let i = 0; i < filas.length; i++) {
            const rr = out[i];
            if (rr.status === 'fulfilled' && rr.value && rr.value.cuerpo) {
              try {
                await sql`UPDATE prospectos SET asunto = ${rr.value.asunto}, email_borrador = ${rr.value.cuerpo}, actualizado_en = NOW() WHERE id = ${filas[i].id}`;
                redactados++;
              } catch { /* sigue */ }
            }
          }
        }
        return jsonResponse(res, 200, { ok: true, descubiertos: negocios.length, insertados, duplicados, enriquecidos, puntuados, redactados });
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
        const r = await generarFrio({ ...p, ...b });
        const [row] = await sql`UPDATE prospectos SET asunto = ${r.asunto}, email_borrador = ${r.cuerpo}, actualizado_en = NOW() WHERE id = ${b.id} RETURNING *`;
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

      // Agente PRO: investiga cada negocio en internet y redacta un email PERSONALIZADO (fuerte/debil).
      if (accion === 'redactar_pro') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
        const limite = Math.min(parseInt(b.limite, 10) || 4, 6);
        const filas = b.id
          ? await sql`SELECT * FROM prospectos WHERE id = ${b.id}`
          : await sql`
              SELECT * FROM prospectos
              WHERE estado = 'nuevo' AND (observaciones IS NULL OR observaciones NOT LIKE '%[PRO]%')
              ORDER BY (prioridad = 'Alta') DESC NULLS LAST, creado_en ASC
              LIMIT ${limite}`;
        const res2 = await Promise.allSettled(filas.map(async (p) => {
          const r = await redactarPro(p);
          const obs = (p.observaciones ? p.observaciones + '\n' : '') + `[PRO] Fuerte: ${r.fuerte || '-'} | Debil: ${r.debil || '-'}`;
          await sql`UPDATE prospectos SET asunto = ${r.asunto}, email_borrador = ${r.cuerpo}, observaciones = ${obs}, actualizado_en = NOW() WHERE id = ${p.id}`;
          return true;
        }));
        const redactados = res2.filter((x) => x.status === 'fulfilled').length;
        const [{ pendientes }] = await sql`
          SELECT COUNT(*)::int AS pendientes FROM prospectos
          WHERE estado = 'nuevo' AND (observaciones IS NULL OR observaciones NOT LIKE '%[PRO]%')`;
        return jsonResponse(res, 200, { ok: true, redactados, pendientes });
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
<p>Buscando por internet di con tu negocio y me llamo la atencion. En Conecta Nex, de Digital Conect, ayudamos a fidelizar a tus clientes con boletines de diseno profesional, campanas automatizadas y segmentos creados con inteligencia artificial, para que cada cliente reciba el mensaje adecuado y vuelva mas a menudo.</p>
<p>Si te apetece, te lo enseno en una llamada corta y sin compromiso. Un saludo, Lazaro.</p>`;
        await enviarEmail({ to, subject: '[PRUEBA] Asi se ve tu email de captacion - Conecta Nex', html: emailHtml(cuerpo, em, { id: 0 }), replyTo: process.env.REPLY_TO_EMAIL, attachments: ADJUNTOS_INLINE });
        return jsonResponse(res, 200, { ok: true, to });
      }

      if (accion === 'convertir') {
        if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!b.nif || !String(b.nif).trim()) return jsonResponse(res, 400, { error: 'El NIF/CIF es obligatorio para crear el cliente.' });
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${b.id}`;
        if (!p) return jsonResponse(res, 404, { error: 'Prospecto no encontrado' });
        if (p.cliente_id) return jsonResponse(res, 400, { error: 'Este prospecto ya es cliente.' });
        const cli = await convertirEnCliente(p, b);
        await sql`UPDATE prospectos SET estado = 'convertido', cliente_id = ${cli.id}, actualizado_en = NOW() WHERE id = ${b.id}`;
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
