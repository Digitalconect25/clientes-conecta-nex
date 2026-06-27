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
import { modalidadTextoLead, modalidadParaIcs } from './_modalidad.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOWS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaLarga(fecha) {
  try {
    const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00');
    return `${DOWS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return String(fecha); }
}

function pagina({ titulo, mensaje, color = '#16a34a', detalle = '', extra = '' }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo} · Conecta NEX</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#f6f3ee;color:#2b2b2b;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:18px}
  .card{background:#fff;border:1px solid #e9e4dc;border-radius:16px;max-width:440px;width:100%;overflow:hidden;box-shadow:0 6px 24px rgba(16,40,28,.08)}
  .top{background:#5b3fa0;color:#fff;padding:22px 24px}
  .top h1{margin:0;font-size:20px}
  .body{padding:26px 24px;text-align:center}
  .icon{width:64px;height:64px;border-radius:50%;background:${color};margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px}
  .msg{font-size:16px;line-height:1.5}
  .det{margin-top:10px;color:#67756c;font-size:14px}
  .cta{display:inline-block;margin-top:18px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px}
  .foot{color:#9a9384;font-size:12px;margin-top:22px}
</style></head><body>
  <div class="card">
    <div class="top"><h1>Conecta NEX</h1></div>
    <div class="body">
      <div class="icon">${color === '#16a34a' ? '✓' : '!'}</div>
      <div class="msg"><b>${titulo}</b><br>${mensaje}</div>
      ${detalle ? `<div class="det">${detalle}</div>` : ''}
      ${extra || ''}
      <div class="foot">Calle Alberola 24, Alicante · conectanex.es</div>
    </div>
  </div>
</body></html>`;
}

// Email de "cita confirmada" con .ics y boton al formulario del negocio.
function emailConfirmadaHTML({ nombre, cuando, urlFormulario, modalidadTxt }) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#2b2b2b">
    <div style="text-align:center;padding:14px 0 6px">
      <img src="${BASE}/logo-email.png" alt="Conecta NEX" width="150" style="max-width:150px;height:auto;display:inline-block">
    </div>
    <div style="background:#16a34a;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;color:#fff">Tu cita queda confirmada</h2>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Hola ${nombre || ''},</p>
      <p>Perfecto, <b>tu cita queda reservada en firme</b>:</p>
      <table style="width:100%;border-collapse:collapse;margin:10px 0 16px">
        <tr><td style="padding:7px 0;color:#888">Cuándo</td><td style="padding:7px 0;font-weight:bold">${cuando}</td></tr>
        <tr><td style="padding:7px 0;color:#888">Cómo</td><td style="padding:7px 0">${modalidadTxt}</td></tr>
      </table>
      <p style="color:#444">Te adjuntamos el evento para que lo <b>añadas a tu calendario</b>. Te enviaremos un recordatorio antes.</p>
      ${urlFormulario ? `
      <div style="background:#f7f5ff;border:1px solid #e7e1fb;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 10px"><b>Para aprovechar la llamada al máximo</b>, cuéntanos un poco de tu negocio (2 minutos). Así llegamos con ideas concretas para ti.</p>
        <a href="${urlFormulario}" style="display:inline-block;background:#5b3fa0;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:8px">Cuéntanos de tu negocio</a>
      </div>` : ''}
      <p style="font-size:13px;color:#888">Si necesitas cambiar la fecha, responde a este correo y lo ajustamos.</p>
      <p style="margin-top:18px">Un saludo,<br><b>Equipo Conecta NEX</b><br>
      <span style="color:#888;font-size:13px">Calle Alberola 24, Alicante · conectanex.es</span></p>
    </div>
  </div>`;
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
          html: emailConfirmadaHTML({ nombre: cita.nombre, cuando, urlFormulario, modalidadTxt: modalidadTextoLead(cita.modalidad, cita.enlace_reunion) }),
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
