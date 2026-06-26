// Webhook PUBLICO de Resend Inbound: recibe los emails entrantes (respuestas)
// y los guarda en mensajes_recibidos para verlos en la Bandeja del panel.
// El webhook SOLO trae metadatos; el cuerpo se trae con el email_id (puede
// tardar unos segundos, por eso se reintenta y, si no, se completa al abrir
// la Bandeja - ver api/mensajes.js).
//
// Seguridad: si defines INBOUND_TOKEN en Vercel, exige ?token=ESE.
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { traerContenidoResend, extraerCuerpoDeWebhook } from './_resend.js';
import { llamarIA, iaHabilitada } from './_groq.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

const soloEmail = (s) => {
  const m = String(s || '').match(/[^\s<>"]+@[^\s<>"]+/);
  return m ? m[0].toLowerCase() : '';
};

// Escapa texto no confiable antes de meterlo en el HTML del email reenviado.
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const token = process.env.INBOUND_TOKEN;
  if (token && req.query.token !== token) return jsonResponse(res, 401, { error: 'no auth' });
  try {
    const b = req.body || {};
    try {
      const ip = String(req.headers['x-forwarded-for'] || 'webhook').split(',')[0];
      await sql`INSERT INTO peticiones_publicas (ip, ruta) VALUES (${ip}, ${'inbound:' + (b.type || 'sin-tipo')})`;
    } catch { /* log opcional */ }
    if (b.type && b.type !== 'email.received' && b.type !== 'inbound.email') return jsonResponse(res, 200, { ok: true, ignorado: b.type });

    const d = b.data || b;
    let de = String(d.from?.address || d.from || d.sender || d.From || '').trim();
    let toRaw = Array.isArray(d.to) ? (d.to[0]?.address || d.to[0]) : (d.to || d.To || d.recipient || '');
    let asunto = String(d.subject || d.Subject || '');
    let texto = String(d.text || '');
    let html = String(d.html || '');
    const emailId = d.email_id || d.id || null;

    // 1) Si el propio webhook trae el cuerpo (segun configuracion), lo usamos.
    if (!texto && !html) {
      const wb = extraerCuerpoDeWebhook(b);
      if (wb) { texto = wb.text || ''; html = wb.html || ''; }
    }
    // 2) Si no, lo pedimos a la API (y, dentro, se intenta el email crudo).
    //    Si la cuenta del webhook coincide con la de la clave, entra aqui.
    if (!texto && !html && emailId) {
      const full = await traerContenidoResend(emailId, 1);
      if (full) {
        de = full.from || de;
        if (full.to) toRaw = full.to;
        asunto = full.subject || asunto;
        texto = full.text || '';
        html = full.html || '';
      }
    }
    const para = String(toRaw || '').trim();

    let prospecto_id = null, cliente_id = null, primeraRespuesta = false;
    const correo = soloEmail(de);
    if (correo) {
      const [p] = await sql`SELECT id, estado FROM prospectos WHERE lower(email) = ${correo} LIMIT 1`;
      if (p) { prospecto_id = p.id; primeraRespuesta = p.estado !== 'respondido' && p.estado !== 'convertido'; await sql`UPDATE prospectos SET estado = 'respondido', actualizado_en = NOW() WHERE id = ${p.id} AND estado != 'convertido'`; }
      const [c] = await sql`SELECT id FROM clientes WHERE lower(email) = ${correo} LIMIT 1`;
      if (c) cliente_id = c.id;
    }
    if (!de && !asunto && !emailId) return jsonResponse(res, 200, { ok: true, vacio: true });

    await sql`INSERT INTO mensajes_recibidos (de, para, asunto, texto, html, prospecto_id, cliente_id, email_id)
      VALUES (${de}, ${para}, ${asunto}, ${texto}, ${html}, ${prospecto_id}, ${cliente_id}, ${emailId})`;

    // La IA lee la respuesta del lead, la cualifica y redacta una contestacion
    // (queda en email_borrador para enviarla MANUAL desde Prospeccion).
    let ia = null;
    if (prospecto_id && iaHabilitada() && (texto || html)) {
      try {
        const [p] = await sql`SELECT * FROM prospectos WHERE id = ${prospecto_id}`;
        if (p) {
          const cuerpoTxt = (texto || String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 1500);
          const sys = `Eres el asistente comercial de Conecta Nex (marketing para negocios). Un negocio al que contactamos en frio HA RESPONDIDO a nuestro email. Devuelve EXACTAMENTE este formato:
ANALISIS: <1-2 frases: nivel de interes (alto/medio/bajo) y que pide u objecion>
RESPUESTA: <email de respuesta breve, calido, espanol de Espana, sin emojis ni guion largo, que conteste a lo que dice y le invite con naturalidad a contarnos su negocio en 2 minutos (${BASE_URL}/solicitud?p=${p.id}) o a agendar una llamada (${BASE_URL}/agendar?p=${p.id}); sin presionar ni prometer resultados>`;
          const user = `Negocio: ${p.empresa || p.nombre || '(s/n)'}. Sector: ${p.sector || '(no indicado)'}.\nSu respuesta:\n"""${cuerpoTxt}"""`;
          const { texto: out } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.5, max_tokens: 500 });
          const ma = out.match(/ANALISIS:\s*([\s\S]*?)\n\s*RESPUESTA:/i);
          const mr = out.match(/RESPUESTA:\s*([\s\S]*)$/i);
          ia = { analisis: ma ? ma[1].trim() : '', respuesta: mr ? mr[1].trim() : out.trim() };
          const obsPrev = p.observaciones ? p.observaciones + '\n\n' : '';
          await sql`UPDATE prospectos SET
              observaciones = ${obsPrev + '[Respondio el lead] ' + (ia.analisis || cuerpoTxt.slice(0, 200))},
              email_borrador = ${ia.respuesta || p.email_borrador || ''},
              asunto = ${'Re: ' + String(asunto || p.asunto || '').replace(/^\s*Re:\s*/i, '')},
              actualizado_en = NOW()
            WHERE id = ${prospecto_id}`;
        }
      } catch (e) { console.error('inbound IA error:', e.message); }
    }

    // Reenvia copia a tu Gmail (con el cuerpo si ya lo tenemos; si no, un aviso).
    try {
      const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
      const destino = process.env.AGENCY_EMAIL || em?.email;
      if (destino && emailHabilitado()) {
        const cuerpo = html || (texto ? `<pre style="font-family:sans-serif;white-space:pre-wrap">${esc(texto)}</pre>` : '<p style="color:#777">Abre la Bandeja del panel para ver el contenido completo.</p>');
        await enviarEmail({
          to: destino,
          subject: `Respuesta de ${de || 'un prospecto'}: ${asunto || '(sin asunto)'}`,
          html: `<p style="color:#555">Nueva respuesta de <b>${esc(de)}</b> (asunto: ${esc(asunto) || '(sin asunto)'}).</p>${ia ? `<div style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:12px;margin:10px 0;font-family:sans-serif"><b>IA · cualificación:</b><br>${esc(ia.analisis)}<br><br><b>Respuesta sugerida</b> (revísala y envíala desde Prospección con un clic):<div style="background:#fff;border:1px solid #e3e8e5;border-radius:8px;padding:10px;margin-top:6px;white-space:pre-wrap">${esc(ia.respuesta)}</div></div>` : ''}<hr>${cuerpo}`,
          replyTo: correo || undefined,
        });
      }
    } catch { /* reenvio opcional */ }

    // Acuse AUTOMATICO al lead en su PRIMERA respuesta: un humano toma el relevo a partir de aqui.
    if (primeraRespuesta && correo && emailHabilitado() && !/^\s*baja\s*$/i.test(texto || '')) {
      try {
        await enviarEmail({
          to: correo,
          subject: 'Re: ' + String(asunto || 'tu mensaje').replace(/^\s*Re:\s*/i, ''),
          html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto"><p>Hola,</p><p>Gracias por tu respuesta. La hemos recibido y <b>en breve un miembro de nuestro equipo se pondrá en contacto contigo</b>.</p><p>Un saludo,<br>Equipo de Conecta Nex</p></div>`,
          replyTo: process.env.REPLY_TO_EMAIL,
        });
      } catch (e) { console.error('inbound ack:', e.message); }
    }
    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('inbound error:', err);
    return jsonResponse(res, 200, { ok: false });
  }
}
