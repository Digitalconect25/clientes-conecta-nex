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
function emailHtml(cuerpo, em) {
  const raw = String(cuerpo || '');
  // Si la IA ya devolvio HTML (<p>, <ul>...), se respeta; si es texto plano, se escapa.
  const tieneHtml = /<\w+[^>]*>/.test(raw);
  const body = tieneHtml
    ? raw
    : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222">${body}${pieLegal(em)}</div>`;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Generacion del email en frio con IA (Groq) ──────────────────────────────
async function generarFrio(p) {
  const sin = (p.situacion || 'sin_presencia') !== 'mejorable';
  const sys = `Eres el asistente de captacion de Conecta Nex, agencia digital de Alicante (Espana). El emisor es Lazaro Carrazana, autonomo, dueno de la agencia. Escribe un email de PRIMER CONTACTO EN FRIO a un negocio local.
Voz y reglas:
- Espanol de Espana, profesional, cercano y humano.
- NUNCA uses guion largo (em-dash). Usa guion corto (-) o comas.
- NO uses emojis. Frases cortas y medianas.
- Nada de formulas vacias ("no dudes en contactarnos", "quedo a tu disposicion", "es un placer"), ni promesas garantizadas, ni urgencias falsas.
- Tono consultivo y NADA agresivo: aportar valor y abrir conversacion, no vender de golpe.
Contenido:
- Saludo (usa el nombre del contacto si lo hay; si no, un "Hola" cordial).
- Una frase que demuestre que has mirado su negocio (menciona sector y ciudad y la observacion concreta).
- ${sin
    ? 'El negocio apenas tiene presencia online: comenta con tacto el coste de oportunidad (clientes que les buscan en Google o redes y no les encuentran), sin culpabilizar.'
    : 'El negocio ya tiene algo de presencia: reconocelo y senala 1-2 mejoras concretas que podrian traerle mas clientes.'}
- Ofrece ayuda de bajo compromiso (una idea gratis o una llamada corta de 10 min).
- Cierre cordial.
Maximo 120 palabras. NO menciones precios ni cifras.
Devuelve EXACTAMENTE este formato:
ASUNTO: <asunto corto, honesto, sin clickbait>
---
<cuerpo del email en HTML simple usando <p>>`;
  const user = `Negocio: ${p.empresa || p.nombre || '(sin nombre)'}. Sector: ${p.sector || '(no indicado)'}. Ciudad: ${p.ciudad || '(no indicada)'}.
Presencia online: ${p.website ? p.website : 'no le hemos encontrado web ni redes'}.
Situacion: ${sin ? 'sin presencia online' : 'presencia mejorable'}.
Observaciones del analisis: ${p.observaciones || '(ninguna)'}.
Persona de contacto: ${p.nombre || '(desconocida)'}.`;
  const { texto } = await llamarIA({
    mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    temperatura: 0.6,
    max_tokens: 600,
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
        await enviarEmail({ to: p.email, subject: asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(cuerpo, em) });
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
            await enviarEmail({ to: p.email, subject: p.asunto || `Una idea para ${p.empresa || 'tu negocio'}`, html: emailHtml(p.email_borrador, em) });
            await sql`UPDATE prospectos SET estado = 'email_enviado', enviado_en = NOW(), actualizado_en = NOW() WHERE id = ${p.id}`;
            ok++;
          } catch { /* sigue */ }
        }
        return jsonResponse(res, 200, { enviados: ok, total: pend.length });
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
