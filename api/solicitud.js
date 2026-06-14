// Endpoint PUBLICO del formulario de solicitud (sin login de agencia).
//   GET  /api/solicitud           -> { categorias: [{categoria, servicios:[...]}] }
//   POST /api/solicitud  { nombre, empresa, email, telefono, sector, mensaje, servicios:[ids], origen }
//        -> crea un prospecto (origen 'formulario') con los servicios pedidos.
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { obtenerIp, limitar } from './_publico.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Recomendacion de servicios con IA: devuelve { recomendacion, servicios:[ids] }.
async function recomendar(sector, necesidad) {
  if (!iaHabilitada()) return { recomendacion: 'La recomendacion automatica no esta disponible ahora mismo. Marca tu mismo los servicios que te interesen y nosotros te asesoramos.', servicios: [] };
  const rows = await sql`SELECT id, nombre, categoria, descripcion FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
  const validos = new Set(rows.map((r) => r.id));
  const catalogo = rows.map((s) => `- [${s.id}] ${s.nombre} [${s.categoria}]: ${s.descripcion || ''}`).join('\n');
  const sys = `Eres asesor de Conecta Nex (de Digital Conect). Recomienda SOLO servicios del catalogo de abajo (nunca inventes servicios). NO menciones precios. Espanol de Espana, claro y breve (max 110 palabras): 2-4 servicios que encajen y por que, en frases cortas. NO uses guion largo (em-dash) ni emojis. No prometas resultados garantizados.
Al FINAL del todo, en una linea aparte, escribe los IDs de los servicios que recomiendas con este formato exacto: IDS: 3, 5, 7
Catalogo:\n${catalogo}`;
  const user = `Sector/actividad: ${sector || '(no indicado)'}. Lo que necesita: ${necesidad || '(no indicado)'}.`;
  try {
    const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.5, max_tokens: 420 });
    let recomendacion = texto, servicios = [];
    const m = texto.match(/IDS:\s*([0-9,\s]+)/i);
    if (m) {
      servicios = m[1].split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => n && validos.has(n));
      recomendacion = texto.slice(0, texto.indexOf(m[0])).trim();
    }
    return { recomendacion, servicios };
  } catch {
    return { recomendacion: 'No se pudo generar la recomendacion ahora mismo. Marca los servicios que te interesen y te asesoramos.', servicios: [] };
  }
}

// Evaluación breve del negocio con IA (diagnóstico + servicios que encajan + prioridad).
async function evaluarNegocio({ empresa, sector, necesidad, servicios }) {
  if (!iaHabilitada()) return '';
  const rows = await sql`SELECT nombre, categoria FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
  const catalogo = rows.map((s) => `- ${s.nombre} [${s.categoria}]`).join('\n');
  const sys = `Eres analista de Conecta Nex. A partir de lo que un negocio ha enviado por el formulario, escribe una evaluacion BREVE para que el equipo prepare el contacto. Espanol de Espana, maximo 90 palabras, sin emojis, sin guion largo, sin prometer resultados. Tres lineas: 1) Diagnostico de su situacion/necesidad. 2) Que servicios NUESTROS encajan (solo del catalogo de abajo, no inventes). 3) Prioridad de contacto: Alta, Media o Baja, con un motivo corto.\nCatalogo:\n${catalogo}`;
  const user = `Negocio: ${empresa || '(sin nombre)'}. Sector: ${sector || '(no indicado)'}. Necesidad: ${necesidad || '(no indicada)'}. Servicios marcados: ${servicios || '(ninguno)'}.`;
  try {
    const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.4, max_tokens: 300 });
    return (texto || '').trim();
  } catch { return ''; }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, nombre, categoria, descripcion FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
      const map = new Map();
      for (const s of rows) {
        if (!map.has(s.categoria)) map.set(s.categoria, []);
        map.get(s.categoria).push({ id: s.id, nombre: s.nombre, descripcion: s.descripcion || '' });
      }
      const categorias = [...map.entries()].map(([categoria, servicios]) => ({ categoria, servicios }));
      return jsonResponse(res, 200, { categorias });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const ip = obtenerIp(req);
      // Recomendacion con IA (consume cuota de Groq): limite mas estricto.
      if (b.accion === 'recomendar') {
        if (!(await limitar(ip, 'recomendar', 8, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
        const r = await recomendar(String(b.sector || ''), String(b.necesidad || b.mensaje || ''));
        return jsonResponse(res, 200, r);
      }
      // Honeypot anti-bots: campo oculto relleno -> fingimos exito sin guardar.
      if (b.website2) return jsonResponse(res, 200, { ok: true, id: 0 });
      if (!(await limitar(ip, 'solicitud', 6, 60))) return jsonResponse(res, 429, { error: 'Demasiadas solicitudes. Intentalo en un momento.' });
      const nombre = String(b.nombre || '').trim();
      const email = String(b.email || '').trim();
      const telefono = String(b.telefono || '').trim();
      if (!nombre) return jsonResponse(res, 400, { error: 'Falta tu nombre.' });
      if (email && !RE_EMAIL.test(email)) return jsonResponse(res, 400, { error: 'Email no valido.' });
      if (!email && !telefono) return jsonResponse(res, 400, { error: 'Deja un email o un telefono para poder contactarte.' });

      // Resolver los servicios elegidos (por id) a nombre/categoria reales.
      const ids = (Array.isArray(b.servicios) ? b.servicios : []).map((x) => parseInt(x, 10)).filter(Boolean);
      let serviciosSel = [];
      if (ids.length) {
        serviciosSel = await sql`SELECT id, nombre, categoria FROM servicios WHERE id = ANY(${ids})`;
      }
      const listaTxt = serviciosSel.map((s) => s.nombre).join(', ');

      // Evaluacion del negocio con IA (diagnostico + servicios que encajan + prioridad).
      const evaluacion = await evaluarNegocio({ empresa: b.empresa, sector: b.sector, necesidad: b.mensaje, servicios: listaTxt });

      const obs = `Solicitud desde formulario${b.origen === 'anuncio' ? ' (anuncio)' : ''}.` +
        (listaTxt ? ` Servicios: ${listaTxt}.` : '') + (b.mensaje ? ` Mensaje: ${String(b.mensaje).trim()}` : '') +
        (evaluacion ? `\n\n[Evaluacion IA] ${evaluacion}` : '');

      // Si viene de un lead en frio (?p=ID), actualizamos ESE prospecto; si no, creamos uno nuevo.
      const pid = parseInt(b.p, 10) || null;
      let row = null;
      if (pid) {
        const [prev] = await sql`SELECT id, observaciones FROM prospectos WHERE id = ${pid}`;
        if (prev) {
          const obsPrev = prev.observaciones ? prev.observaciones + '\n\n' : '';
          [row] = await sql`
            UPDATE prospectos SET
              empresa = COALESCE(NULLIF(${String(b.empresa || '').trim()}, ''), empresa),
              nombre = COALESCE(NULLIF(${nombre}, ''), nombre),
              email = COALESCE(NULLIF(${email}, ''), email),
              telefono = COALESCE(NULLIF(${telefono}, ''), telefono),
              sector = COALESCE(NULLIF(${String(b.sector || '').trim()}, ''), sector),
              observaciones = ${obsPrev + obs},
              servicios_json = ${JSON.stringify(serviciosSel)}::jsonb,
              estado = 'respondido', actualizado_en = NOW()
            WHERE id = ${pid} RETURNING id`;
        }
      }
      if (!row) {
        [row] = await sql`
          INSERT INTO prospectos (empresa, nombre, email, telefono, sector, website, situacion, observaciones, estado, origen, servicios_json)
          VALUES (${String(b.empresa || '').trim()}, ${nombre}, ${email}, ${telefono}, ${String(b.sector || '').trim()},
                  ${''}, ${'mejorable'}, ${obs}, ${'respondido'}, ${b.origen === 'anuncio' ? 'anuncio' : 'formulario'},
                  ${JSON.stringify(serviciosSel)}::jsonb)
          RETURNING id`;
      }

      // Aviso a la agencia con el diagnostico de la IA
      if (emailHabilitado() && process.env.AGENCY_EMAIL) {
        try {
          await enviarEmail({
            to: process.env.AGENCY_EMAIL,
            subject: `Nuevo lead evaluado: ${b.empresa || nombre}`,
            html: `<div style="font-family:sans-serif"><h2>Nuevo lead desde el formulario</h2>
              <p><b>${nombre}</b>${b.empresa ? ' - ' + b.empresa : ''}<br>${email || ''} ${telefono || ''}</p>
              <p>Sector: ${b.sector || '-'}</p>
              <p>Servicios pedidos: ${listaTxt || '-'}</p>
              <p>Mensaje: ${b.mensaje || '-'}</p>
              ${evaluacion ? `<p style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:10px"><b>Evaluacion IA:</b><br>${String(evaluacion).replace(/\n/g, '<br>')}</p>` : ''}</div>`,
          });
        } catch { /* no bloquea */ }
      }
      return jsonResponse(res, 200, { ok: true, id: row.id });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar la solicitud. Intentalo de nuevo.' });
  }
}
