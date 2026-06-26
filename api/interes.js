// Endpoint PUBLICO: el prospecto pulsa "Quiero mi analisis / consulta gratis" en el email.
// Registra el interes, le RESPONDE en automatico, avisa a la agencia y muestra pagina de gracias.
import { sql } from './_db.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { firmaInteres } from './prospectos.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function page(titulo, msg) {
  return `<!doctype html><html lang=es><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial;background:#f4f6fb;color:#10151f;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center">
<div style="background:#fff;border:1px solid #e6e9f0;border-radius:16px;padding:34px 30px;max-width:460px;text-align:center;box-shadow:0 6px 24px rgba(16,24,40,.06)">
<div style="font-size:40px">✅</div><h1 style="font-size:22px;margin:8px 0">${titulo}</h1>
<p style="color:#555;line-height:1.6">${msg}</p></div></body></html>`;
}

export default async function handler(req, res) {
  const send = (code, html) => { res.status(code); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.send(html); };
  try {
    const pid = parseInt(req.query.p, 10);
    const tipo = String(req.query.t || 'analisis');
    const f = String(req.query.f || '');
    if (!pid || !['analisis', 'consulta'].includes(tipo) || f !== firmaInteres(pid, tipo)) {
      return send(400, page('Enlace no válido', 'Este enlace no es correcto o ha caducado. Si quieres, responde directamente a nuestro correo.'));
    }
    try { await sql`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interes_en timestamptz`; } catch { /* noop */ }
    const [p] = await sql`SELECT * FROM prospectos WHERE id = ${pid}`;
    if (!p) return send(404, page('No encontrado', 'No hemos podido localizar tu registro.'));

    const yaPedido = !!p.interes_en;
    const etiqueta = tipo === 'analisis' ? 'tu análisis de visibilidad gratuito' : 'tu consulta gratuita';
    await sql`UPDATE prospectos SET
        estado = CASE WHEN estado = 'convertido' THEN estado ELSE 'respondido' END,
        interes_en = NOW(),
        observaciones = ${(p.observaciones ? p.observaciones + '\n' : '') + '[El lead pidió ' + (tipo === 'analisis' ? 'ANÁLISIS' : 'CONSULTA') + ' gratis desde el email]'},
        actualizado_en = NOW()
      WHERE id = ${pid}`;

    // Respuesta AUTOMATICA al prospecto (una sola vez, si tiene email valido).
    if (!yaPedido && emailHabilitado() && RE_EMAIL.test(String(p.email || ''))) {
      const agendar = `${BASE_URL}/agendar?p=${pid}`;
      const hola = `Hola${p.empresa ? ' ' + p.empresa : ''},`;
      const cuerpo = tipo === 'analisis'
        ? `<p>${hola}</p><p>Gracias por tu interés. Hemos recibido tu solicitud de <b>análisis de visibilidad gratuito</b>: revisaremos cómo te ve hoy internet (Google y la IA) y te lo enviamos en breve, sin compromiso.</p><p>Si lo prefieres, puedes <a href="${agendar}">reservar una llamada corta aquí</a> y te lo contamos en directo.</p><p>Un saludo,<br>Equipo de Conecta Nex</p>`
        : `<p>${hola}</p><p>Gracias por tu interés. Para tu <b>consulta gratuita</b>, elige el hueco que mejor te venga aquí: <a href="${agendar}">reservar llamada</a>. Sin compromiso, en 15 minutos vemos tu caso.</p><p>Un saludo,<br>Equipo de Conecta Nex</p>`;
      try {
        await enviarEmail({
          to: p.email,
          subject: tipo === 'analisis' ? 'Tu análisis de visibilidad gratuito · Conecta Nex' : 'Tu consulta gratuita · Conecta Nex',
          html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto">${cuerpo}</div>`,
          replyTo: process.env.REPLY_TO_EMAIL,
        });
      } catch (e) { console.error('interes auto-reply:', e.message); }
    }

    // Aviso a la agencia.
    try {
      const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
      const destino = process.env.AGENCY_EMAIL || em?.email;
      if (destino && emailHabilitado()) {
        await enviarEmail({
          to: destino,
          subject: `🔥 Lead interesado (${tipo}): ${p.empresa || p.email || ('#' + pid)}`,
          html: `<p style="font-family:sans-serif"><b>${p.empresa || '(sin nombre)'}</b> (${p.sector || '-'}, ${p.ciudad || '-'}) ha pulsado <b>"${tipo === 'analisis' ? 'Quiero mi análisis gratis' : 'Quiero una consulta gratuita'}"</b>.<br>Email: ${p.email || '-'} · Tel: ${p.telefono || '-'}<br>Ábrelo en Prospección para hacer seguimiento.</p>`,
        });
      }
    } catch { /* aviso opcional */ }

    const extra = RE_EMAIL.test(String(p.email || ''))
      ? 'Te acabamos de enviar un correo de confirmación.'
      : 'Te contactaremos en breve.';
    return send(200, page('¡Gracias!', `Hemos recibido tu solicitud de ${etiqueta}. ${extra}`));
  } catch (e) {
    return send(200, page('¡Gracias!', 'Hemos registrado tu solicitud y te contactaremos en breve.'));
  }
}
