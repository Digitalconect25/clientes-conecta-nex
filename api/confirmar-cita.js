// Endpoint PUBLICO: el cliente confirma su cita desde el boton del email.
//   GET /api/confirmar-cita?c=<id>&s=<firma>  -> marca la cita como 'confirmada'
// La firma evita que nadie confirme citas ajenas sin guardar token en BD.
// Al confirmar (la PRIMERA vez) le enviamos:
//   - email "cita confirmada" con .ics (anadir a su calendario)
//   - boton al formulario para conocer su negocio (preparamos la reunion)
import { sql } from './_db.js';
import { firmaCita } from './agendar.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { crearIcs, icsAdjunto } from './_ics.js';
import { modalidadTextoLead, modalidadParaIcs, modalidadLabel } from './_modalidad.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOWS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaLarga(fecha) {
  try {
    const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00');
    return `${DOWS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return String(fecha); }
}

function pagina({ titulo, mensaje, color = '#0c7b6d', detalle = '', extra = '' }) {
  const exito = color === '#0c7b6d' || color === '#16a34a';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo} · Conecta NEX</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f1efe8;color:#20242a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border:1px solid #ece7da;border-radius:18px;max-width:440px;width:100%;overflow:hidden;box-shadow:0 10px 40px rgba(16,40,28,.10)}
  .top{padding:24px 24px 6px;text-align:center;border-bottom:1px solid #f2eee3}
  .top img{max-width:150px;height:auto}
  .body{padding:30px 28px 28px;text-align:center}
  .icon{width:62px;height:62px;border-radius:50%;background:${color};margin:0 auto 18px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;font-weight:700}
  .ttl{font-size:20px;font-weight:700;color:#20242a;margin:0 0 6px}
  .msg{font-size:15.5px;line-height:1.6;color:#4a4f56;margin:0}
  .det{margin-top:14px;display:inline-block;background:#f7f5ef;border:1px solid #efe9db;border-radius:10px;padding:9px 16px;color:#20242a;font-weight:600;font-size:14px}
  .cta{display:inline-block;margin-top:22px;background:#0a5e53;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:10px;font-size:15px}
  .foot{color:#9a9384;font-size:12px;margin-top:24px;line-height:1.6}
  .foot a{color:#0c7b6d;text-decoration:none}
</style></head><body>
  <div class="card">
    <div class="top"><img src="${BASE}/logo-email.png" alt="Conecta NEX"></div>
    <div class="body">
      <div class="icon">${exito ? '✓' : '!'}</div>
      <div class="ttl">${titulo}</div>
      <p class="msg">${mensaje}</p>
      ${detalle ? `<div class="det">${detalle}</div>` : ''}
      ${extra || ''}
      <div class="foot">Conecta NEX · Calle Alberola 24, 03007 Alicante<br><a href="https://conectanex.es">conectanex.es</a></div>
    </div>
  </div>
</body></html>`;
}

// Email de "cita confirmada" con .ics y boton al formulario del negocio.
function emailConfirmadaHTML({ nombre, cuando, urlFormulario, modalidadTxt, formato }) {
  const saludo = nombre ? `Hola ${escEmail(nombre)},` : 'Hola,';
  const cuerpo = `
    <p style="margin:0 0 14px">${saludo}</p>
    <p style="margin:0 0 16px">Perfecto. Tu cita queda <b>reservada en firme</b>:</p>
    ${tarjetaDatos([['Fecha y hora', escEmail(cuando)], ['Formato', escEmail(formato)]])}
    <p style="margin:14px 0 16px">${escEmail(modalidadTxt)} Te enviaremos un recordatorio antes y te adjuntamos el evento para que lo añadas a tu calendario.</p>
    ${urlFormulario ? `<div style="background:#f7f5ef;border:1px solid #efe9db;border-radius:12px;padding:18px;margin:6px 0 2px">
      <p style="margin:0 0 4px;color:#3a3f46">Para sacar el máximo a la cita, cuéntanos un poco de tu negocio (2 minutos). Así llegamos con ideas concretas para ti.</p>
      ${botonEmail(urlFormulario, 'Cuéntanos de tu negocio', '#0a5e53')}
    </div>` : ''}
    <p style="margin:16px 0 0;color:#707a83;font-size:13.5px">Si necesitas cambiar la fecha, responde a este correo y lo ajustamos.</p>
    <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  return envolverEmail({ titulo: 'Tu cita está confirmada', preheader: `Reservada: ${cuando}`, cuerpoHtml: cuerpo });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const c = parseInt(req.query.c, 10);
  const s = String(req.query.s || '');
  if (!c || !s || s !== firmaCita(c)) {
    res.status(400).send(pagina({ titulo: 'Enlace no válido', mensaje: 'Este enlace de confirmación no es válido o ha caducado.', color: '#c0392b' }));
    return;
  }
  try {
    try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS modalidad text DEFAULT 'telefono'`; } catch { /* noop */ }
    try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS enlace_reunion text DEFAULT ''`; } catch { /* noop */ }
    const [cita] = await sql`SELECT id, estado, to_char(fecha,'YYYY-MM-DD') AS fecha, hora, nombre, email, telefono, prospecto_id, COALESCE(modalidad,'telefono') AS modalidad, COALESCE(enlace_reunion,'') AS enlace_reunion FROM citas WHERE id = ${c}`;
    if (!cita) {
      res.status(404).send(pagina({ titulo: 'Cita no encontrada', mensaje: 'No hemos encontrado esta cita.', color: '#c0392b' }));
      return;
    }
    const cuando = `${fechaLarga(cita.fecha)} a las ${cita.hora} h`;
    const cuandoCorto = `${String(cita.fecha).split('-').reverse().join('/')} a las ${cita.hora} h`;
    if (cita.estado === 'cancelada') {
      res.status(200).send(pagina({ titulo: 'Cita cancelada', mensaje: 'Esta cita fue cancelada. Escríbenos y la reprogramamos encantados.', color: '#b8860b' }));
      return;
    }
    if (cita.estado === 'confirmada' || cita.estado === 'hecha') {
      res.status(200).send(pagina({ titulo: 'Cita ya confirmada', mensaje: 'Tu cita ya estaba confirmada. ¡Te esperamos!', detalle: cuandoCorto }));
      return;
    }
    await sql`UPDATE citas SET estado = 'confirmada' WHERE id = ${c}`;

    // Enlace al formulario para conocer su negocio (solo si viene de un prospecto).
    const urlFormulario = cita.prospecto_id ? `${BASE}/solicitud?p=${cita.prospecto_id}` : `${BASE}/solicitud`;

    // Email de confirmacion con .ics + formulario (no bloquea la confirmacion).
    if (cita.email && emailHabilitado()) {
      try {
        const [em] = await sql`SELECT nombre_comercial, nombre, email, direccion, cp, ciudad FROM emisor WHERE id = 1`;
        const ubic = modalidadParaIcs(cita.modalidad, cita.enlace_reunion);
        const ics = crearIcs({
          id: cita.id, fecha: cita.fecha, hora: cita.hora, durMin: 30,
          titulo: 'Cita con Conecta NEX',
          descripcion: 'Hablamos de cómo mejorar la presencia digital de tu negocio. Conecta NEX (Digital Conect).',
          ubicacion: ubic.ubicacion, url: ubic.url,
          organizadorEmail: em?.email || process.env.AGENCY_EMAIL || undefined,
          organizadorNombre: em?.nombre_comercial || em?.nombre || 'Conecta NEX',
        });
        await enviarEmail({
          to: cita.email,
          subject: `Cita confirmada — ${cuandoCorto} · Conecta NEX`,
          html: emailConfirmadaHTML({ nombre: cita.nombre, cuando, urlFormulario, modalidadTxt: modalidadTextoLead(cita.modalidad, cita.enlace_reunion), formato: modalidadLabel(cita.modalidad) }),
          attachments: [icsAdjunto(ics)],
          replyTo: process.env.REPLY_TO_EMAIL,
        });
      } catch (e) { console.error('Email cita confirmada no enviado:', e.message); }
    }

    const extra = `<a class="cta" href="${urlFormulario}">Cuéntanos de tu negocio (2 min)</a>`;
    res.status(200).send(pagina({ titulo: '¡Cita confirmada!', mensaje: 'Tu reunión queda confirmada. Te enviaremos un recordatorio antes.', detalle: cuandoCorto, extra }));
  } catch (err) {
    console.error(err);
    res.status(500).send(pagina({ titulo: 'Error temporal', mensaje: 'No se pudo confirmar ahora mismo. Inténtalo de nuevo en unos minutos.', color: '#c0392b' }));
  }
}
