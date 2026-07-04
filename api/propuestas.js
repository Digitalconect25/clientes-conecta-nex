// Propuestas comerciales (panel de la agencia, con login).
//   GET    /api/propuestas?prospecto_id=ID  -> lista de ese lead
//   GET    /api/propuestas?id=ID            -> una propuesta
//   POST   { accion:'generar_ia', prospecto_id }  -> borrador con IA (servicios del catalogo + precio)
//   POST   { accion:'crear', prospecto_id, ... }  -> borrador manual
//   POST   { accion:'enviar', id }                -> envia email con enlace de aceptacion
//   PUT    { id, ... }                            -> edita (items, intro, total, etc.)
//   DELETE ?id=ID
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

export const maxDuration = 60;

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const EUR = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

let _mig = false;
async function asegurarTabla() {
  if (_mig) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS propuestas (
      id SERIAL PRIMARY KEY,
      prospecto_id INTEGER,
      cliente_id INTEGER,
      numero TEXT,
      titulo TEXT DEFAULT 'Propuesta de servicios',
      intro TEXT DEFAULT '',
      items_json JSONB DEFAULT '[]'::jsonb,
      descuento NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      notas TEXT DEFAULT '',
      problema TEXT DEFAULT '',
      solucion TEXT DEFAULT '',
      plazo TEXT DEFAULT '',
      validez_dias INTEGER DEFAULT 15,
      estado TEXT DEFAULT 'borrador',
      token TEXT UNIQUE,
      destinatario_email TEXT DEFAULT '',
      destinatario_nombre TEXT DEFAULT '',
      enviada_en TIMESTAMPTZ, vista_en TIMESTAMPTZ, aceptada_en TIMESTAMPTZ,
      acept_nombre TEXT DEFAULT '', acept_ip TEXT DEFAULT '', acept_user_agent TEXT DEFAULT '',
      rechazada_en TIMESTAMPTZ,
      creado_en TIMESTAMP DEFAULT NOW(), actualizado_en TIMESTAMP DEFAULT NOW()
    )`;
  } catch { /* noop */ }
  // Columnas de la propuesta humanizada (diagnostico + plazo), idempotentes.
  try { await sql`ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS problema TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS solucion TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS plazo TEXT DEFAULT ''`; } catch { /* noop */ }
  _mig = true;
}

const token = () => crypto.randomBytes(24).toString('base64url');

async function siguienteNumero(anio) {
  const [row] = await sql`
    INSERT INTO contadores (clave, valor) VALUES (${'propuesta_' + anio}, 1)
    ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW()
    RETURNING valor`;
  return `PROP-${anio}-${String(row.valor).padStart(4, '0')}`;
}

// Calcula total a partir de items y descuento.
function calcularTotal(items, descuento) {
  const sub = (items || []).reduce((s, it) => s + Number(it.subtotal != null ? it.subtotal : (Number(it.precio || 0) * Number(it.cantidad || 1))), 0);
  return Math.max(0, sub - Number(descuento || 0));
}

// IA: elige 2-4 servicios del catalogo (con su precio real) y redacta una intro.
async function generarConIA(p) {
  const cat = await sql`SELECT id, nombre, categoria, precio, descripcion FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
  if (!cat.length) return { intro: '', items: [] };
  const validos = new Map(cat.map((s) => [s.id, s]));
  const listado = cat.map((s) => `- [${s.id}] ${s.nombre} (${s.categoria}) - ${EUR(s.precio)}: ${s.descripcion || ''}`).join('\n');
  const yaInteresa = Array.isArray(p.servicios_json) ? p.servicios_json.map((x) => x.nombre).filter(Boolean).join(', ') : '';
  // Extrae el problema YA detectado de este negocio (lo guarda el agente de captacion
  // en las notas: "[PLAN 120d] ... | Problema: ..." o el analisis de su respuesta).
  const obs = String(p.observaciones || '');
  // Problema ya detectado del negocio. `[^\n]+` (no cortamos en '|') y descartamos el
  // guion de relleno '-' que marcarPlan escribe cuando no habia problema concreto.
  const probMatch = ((obs.match(/Problema:\s*([^\n]+)/i) || [])[1] || '').trim();
  const probPrevio = (probMatch && probMatch !== '-') ? probMatch : '';
  const sys = `Eres asesor comercial de Conecta Nex (agencia de marketing y presencia digital, Alicante). Prepara una PROPUESTA HUMANIZADA y ESPECIFICA para ESTE negocio en concreto: NADA de texto generico ni de plantilla. Parte del PROBLEMA REAL de este negocio, explica COMO lo resuelves para SU caso y en QUE PLAZO (adaptado al tamano de SU problema, no un plazo fijo), y elige SOLO servicios del catalogo de abajo (nunca inventes servicios ni precios).
Espanol de Espana, tono humano, cercano y consultivo, sin emojis, sin guion largo (em-dash), sin prometer resultados garantizados ni cifras inventadas. Menciona detalles concretos de su sector, ciudad o situacion para que se note que es para el.
Devuelve EXACTAMENTE este formato (respeta las etiquetas y este ORDEN):
IDS: <ids de 2 a 4 servicios del catalogo separados por comas, p.ej. 3, 5, 7>
PROBLEMA: <1-2 frases: el problema principal y CONCRETO de presencia digital de ESTE negocio (usa el problema ya detectado si te lo doy), con tacto>
SOLUCION: <2-3 frases: como lo resolvemos con esta propuesta, aterrizado a SU caso concreto>
PLAZO: <plazo realista ADAPTADO a la magnitud de SU problema, en semanas o meses, p.ej. "unas 4 a 6 semanas" o "unos 3 meses"; breve>
INTRO: <2-3 frases calidas y personales que conectan SU problema con la propuesta>`;
  const user = `Negocio: ${p.empresa || p.nombre || '(s/n)'}. Sector: ${p.sector || '-'}. Ciudad: ${p.ciudad || '-'}. Web: ${p.website || 'no tiene'}.
Situacion: ${p.situacion === 'mejorable' ? 'tiene algo de presencia pero mejorable' : 'sin apenas presencia online'}.
${probPrevio ? 'PROBLEMA YA DETECTADO de este negocio (usalo como base): ' + probPrevio : ''}
Le interesa (del formulario): ${yaInteresa || '(no indicado)'}.
Notas internas del negocio: ${obs.slice(0, 900)}.
Catalogo:\n${listado}`;
  const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.55, max_tokens: 900 });
  const campo = (re) => ((texto.match(re) || [])[1] || '').trim();
  // Si un campo salio vacio, el fallback puede engullir la seccion siguiente: si el
  // valor empieza por otra etiqueta conocida, lo tratamos como vacio.
  const sano = (v) => (/^\s*(?:IDS|PROBLEMA|SOLUCION|PLAZO|INTRO)\s*:/i.test(v) ? '' : v);
  // IDS va primero (asi no se pierde si la respuesta se trunca). Cortes multilinea con flag /s en los fallbacks.
  const mids = texto.match(/IDS:\s*([0-9,\s]+)/i);
  const problema = sano(campo(/PROBLEMA:\s*([\s\S]*?)\n\s*SOLUCION:/i) || campo(/PROBLEMA:\s*([\s\S]+?)(?=\n\s*(?:SOLUCION|PLAZO|INTRO|IDS):|$)/i) || campo(/PROBLEMA:\s*(.+)/is));
  const solucion = sano(campo(/SOLUCION:\s*([\s\S]*?)\n\s*PLAZO:/i) || campo(/SOLUCION:\s*([\s\S]+?)(?=\n\s*(?:PLAZO|INTRO|IDS):|$)/i) || campo(/SOLUCION:\s*(.+)/is));
  const plazo = sano(campo(/PLAZO:\s*(.+)/i));
  const mi = texto.match(/INTRO:\s*([\s\S]*?)(?=\n\s*IDS:|$)/i);
  const intro = sano(mi ? mi[1].trim() : campo(/INTRO:\s*(.+)/is));
  const ids = mids ? mids[1].split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => validos.has(n)) : [];
  const items = ids.map((id) => {
    const s = validos.get(id);
    return { servicio_id: id, nombre: s.nombre, descripcion: s.descripcion || '', cantidad: 1, precio: Number(s.precio), subtotal: Number(s.precio) };
  });
  return { intro, problema, solucion, plazo, items };
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  // La automatización (cron / generación tras cita) se autentica con CRON_SECRET en el body.
  const cronOk = req.method === 'POST' && !!process.env.CRON_SECRET && req.body?.secret === process.env.CRON_SECRET;
  if (!auth.ok && !cronOk) return jsonResponse(res, 401, { error: auth.error });
  try {
    await asegurarTabla();

    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM propuestas WHERE id = ${parseInt(req.query.id, 10)}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrada' });
        return jsonResponse(res, 200, row);
      }
      const pid = parseInt(req.query.prospecto_id, 10) || null;
      const rows = pid
        ? await sql`SELECT * FROM propuestas WHERE prospecto_id = ${pid} ORDER BY creado_en DESC`
        : await sql`SELECT id, prospecto_id, numero, titulo, total, estado, enviada_en, aceptada_en, creado_en FROM propuestas ORDER BY creado_en DESC LIMIT 100`;
      return jsonResponse(res, 200, { propuestas: rows, ia_habilitada: iaHabilitada(), email_habilitado: emailHabilitado() });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const accion = b.accion || 'crear';

      if (accion === 'generar_ia' || accion === 'crear') {
        const pid = parseInt(b.prospecto_id, 10);
        if (!pid) return jsonResponse(res, 400, { error: 'Falta prospecto_id' });
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${pid}`;
        if (!p) return jsonResponse(res, 404, { error: 'Prospecto no encontrado' });

        let intro = b.intro || '', items = Array.isArray(b.items) ? b.items : [];
        let problema = b.problema || '', solucion = b.solucion || '', plazo = b.plazo || '';
        if (accion === 'generar_ia') {
          if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
          const r = await generarConIA(p);
          intro = r.intro; items = r.items; problema = r.problema; solucion = r.solucion; plazo = r.plazo;
          // Sin servicios no hay propuesta (evita crear una a 0 EUR por una respuesta IA truncada/invalida).
          if (!items.length) return jsonResponse(res, 502, { error: 'La IA no seleccionó servicios del catálogo. Reintenta, o crea la propuesta en blanco y añade las líneas a mano.' });
        }
        const descuento = Number(b.descuento || 0);
        const total = calcularTotal(items, descuento);
        const anio = new Date().getFullYear();
        const numero = await siguienteNumero(anio);
        const [row] = await sql`
          INSERT INTO propuestas (prospecto_id, numero, titulo, intro, items_json, descuento, total, notas, problema, solucion, plazo, validez_dias, estado, token, destinatario_email, destinatario_nombre)
          VALUES (${pid}, ${numero}, ${b.titulo || 'Propuesta de servicios'}, ${intro}, ${JSON.stringify(items)}::jsonb,
                  ${descuento}, ${total}, ${b.notas || ''}, ${problema}, ${solucion}, ${plazo}, ${parseInt(b.validez_dias, 10) || 15}, ${'borrador'}, ${token()},
                  ${p.email || ''}, ${p.empresa || p.nombre || ''})
          RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      if (accion === 'enviar') {
        const id = parseInt(b.id, 10);
        if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado.' });
        const [pr] = await sql`SELECT * FROM propuestas WHERE id = ${id}`;
        if (!pr) return jsonResponse(res, 404, { error: 'No encontrada' });
        const email = (b.email || pr.destinatario_email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return jsonResponse(res, 400, { error: 'Falta un email válido del destinatario.' });
        const tok = pr.token || token();
        const url = `${BASE}/propuesta/${tok}`;
        // Texto de la IA a HTML: escapa y respeta los saltos de linea (<br>).
        const multi = (t) => escEmail(t).replace(/\n/g, '<br>');
        // Fondo tenue por bloque en hex de 6 digitos (los de 8 con alfa no los pinta Outlook escritorio).
        const bloque = (color, fondo, etiqueta, texto) => texto
          ? `<div style="background:${fondo};border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:11px 14px;margin:0 0 12px"><b style="color:${color}">${etiqueta}</b><br>${multi(texto)}</div>`
          : '';
        const servicios = Array.isArray(pr.items_json) ? pr.items_json : [];
        const listaServicios = servicios.length
          ? `<p style="margin:14px 0 6px"><b>Qué incluye:</b></p><ul style="margin:0 0 12px;padding-left:18px;color:#333">${servicios.map((it) => `<li style="margin:2px 0">${escEmail(it.nombre || '')}</li>`).join('')}</ul>`
          : '';
        const cuerpo = `
          <p style="margin:0 0 14px">Hola ${escEmail(pr.destinatario_nombre || '')},</p>
          <p style="margin:0 0 16px">${multi(pr.intro || 'Le damos una vuelta a la presencia digital de tu negocio y te contamos cómo mejorarla.')}</p>
          ${bloque('#ea580c', '#fff6ec', 'Lo que vemos', pr.problema)}
          ${bloque('#0c7b6d', '#eef8f5', 'Cómo lo resolvemos', pr.solucion)}
          ${bloque('#5b3fa0', '#f3f0fa', 'En cuánto tiempo', pr.plazo)}
          ${listaServicios}
          ${tarjetaDatos([['Propuesta', escEmail(pr.numero || '')], ['Base imponible', EUR(pr.total)], ['Total (IVA 21% incl.)', EUR(Number(pr.total) * 1.21)], ['Validez', `${pr.validez_dias} días`]])}
          <p style="margin:14px 0 4px">Puedes verla en detalle y, si te encaja, aceptarla desde aquí:</p>
          ${botonEmail(url, 'Ver y aceptar la propuesta')}
          <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">Si tienes cualquier duda, responde a este correo y lo vemos sin compromiso.</p>
          <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
        await enviarEmail({
          to: email,
          subject: `Tu propuesta ${pr.numero || ''} · Conecta NEX`,
          html: envolverEmail({ titulo: 'Tu propuesta está lista', preheader: `Propuesta ${pr.numero} · ${EUR(pr.total)}`, cuerpoHtml: cuerpo }),
          replyTo: process.env.REPLY_TO_EMAIL,
        });
        const [row] = await sql`UPDATE propuestas SET estado = CASE WHEN estado IN ('aceptada','rechazada') THEN estado ELSE 'enviada' END,
            token = ${tok}, destinatario_email = ${email}, enviada_en = COALESCE(enviada_en, NOW()), actualizado_en = NOW()
          WHERE id = ${id} RETURNING *`;
        // Reflejar en el prospecto que ya tiene propuesta enviada (nota, sin romper su estado).
        if (pr.prospecto_id) {
          try { await sql`UPDATE prospectos SET observaciones = COALESCE(observaciones,'') || ${'\n[Propuesta ' + (pr.numero || '') + ' enviada: ' + EUR(pr.total) + ']'}, actualizado_en = NOW() WHERE id = ${pr.prospecto_id}`; } catch { /* noop */ }
        }
        return jsonResponse(res, 200, row);
      }

      return jsonResponse(res, 400, { error: 'Acción no válida' });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      const id = parseInt(b.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const items = b.items != null ? (Array.isArray(b.items) ? b.items : []) : null;
      const descuento = b.descuento != null ? Number(b.descuento) : null;
      let total = null;
      if (items != null || descuento != null) {
        const [cur] = await sql`SELECT items_json, descuento FROM propuestas WHERE id = ${id}`;
        const itx = items != null ? items : (cur?.items_json || []);
        const dsc = descuento != null ? descuento : Number(cur?.descuento || 0);
        total = calcularTotal(itx, dsc);
      }
      const [row] = await sql`UPDATE propuestas SET
          titulo = COALESCE(${b.titulo ?? null}, titulo),
          intro = COALESCE(${b.intro ?? null}, intro),
          problema = COALESCE(${b.problema ?? null}, problema),
          solucion = COALESCE(${b.solucion ?? null}, solucion),
          plazo = COALESCE(${b.plazo ?? null}, plazo),
          items_json = COALESCE(${items != null ? JSON.stringify(items) : null}::jsonb, items_json),
          descuento = COALESCE(${descuento}, descuento),
          total = COALESCE(${total}, total),
          notas = COALESCE(${b.notas ?? null}, notas),
          validez_dias = COALESCE(${b.validez_dias != null ? parseInt(b.validez_dias, 10) : null}, validez_dias),
          estado = COALESCE(${b.estado ?? null}, estado),
          actualizado_en = NOW()
        WHERE id = ${id} RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM propuestas WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('propuestas error:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
