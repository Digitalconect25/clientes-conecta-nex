import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { enviarEmail, emailHabilitado } from './_email.js';

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

function cabeceraLogo() {
  return `<div style="text-align:center;padding:6px 0 18px"><img src="${LOGO_URL}" alt="Conecta Nex" style="max-width:170px;height:auto"></div>`;
}
function bannerPie() {
  if (!BANNER_URL) return '';
  return `<div style="margin-top:18px;text-align:center"><img src="${BANNER_URL}" alt="Conecta Nex" style="max-width:100%;height:auto;border-radius:8px"></div>`;
}

// Botones de accion del email: agendar cita, llamar y responder.
function botonesCTA(em, p) {
  const link = `${BASE_URL}/agendar?p=${p && p.id ? p.id : ''}`;
  const tel = String(em.telefono || '').replace(/\s+/g, '');
  const btn = (href, txt, bg) => `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin:4px 8px 4px 0">${txt}</a>`;
  return `<div style="margin:20px 0 6px">
    ${btn(link, 'Agendar una llamada', '#16a34a')}
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

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
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
        await enviarEmail({ to: p.email, subject: asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(cuerpo, em, p) });
        const [row] = await sql`UPDATE prospectos SET asunto = ${asunto || ''}, email_borrador = ${cuerpo}, estado = 'email_enviado', enviado_en = NOW(), actualizado_en = NOW() WHERE id = ${b.id} RETURNING *`;
        return jsonResponse(res, 200, row);
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
            await enviarEmail({ to: p.email, subject: p.asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(p.email_borrador, em, p) });
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
        await enviarEmail({ to, subject: '[PRUEBA] Asi se ve tu email de captacion - Conecta Nex', html: emailHtml(cuerpo, em, { id: 0 }) });
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
