// Endpoint PUBLICO: el cliente confirma su cita desde el boton del email.
//   GET /api/confirmar-cita?c=<id>&s=<firma>  -> marca la cita como 'confirmada'
// La firma evita que nadie confirme citas ajenas sin guardar token en BD.
import { sql } from './_db.js';
import { firmaCita } from './agendar.js';

function pagina({ titulo, mensaje, color = '#16a34a', detalle = '' }) {
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
  .foot{color:#9a9384;font-size:12px;margin-top:22px}
</style></head><body>
  <div class="card">
    <div class="top"><h1>Conecta NEX</h1></div>
    <div class="body">
      <div class="icon">${color === '#16a34a' ? '✓' : '!'}</div>
      <div class="msg"><b>${titulo}</b><br>${mensaje}</div>
      ${detalle ? `<div class="det">${detalle}</div>` : ''}
      <div class="foot">Calle Alberola 24, Alicante · conectanex.es</div>
    </div>
  </div>
</body></html>`;
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
    const [cita] = await sql`SELECT id, estado, fecha, hora FROM citas WHERE id = ${c}`;
    if (!cita) {
      res.status(404).send(pagina({ titulo: 'Cita no encontrada', mensaje: 'No hemos encontrado esta cita.', color: '#c0392b' }));
      return;
    }
    const cuando = `${String(cita.fecha).split('-').reverse().join('/')} a las ${cita.hora} h`;
    if (cita.estado === 'cancelada') {
      res.status(200).send(pagina({ titulo: 'Cita cancelada', mensaje: 'Esta cita fue cancelada. Escríbenos y la reprogramamos encantados.', color: '#b8860b' }));
      return;
    }
    if (cita.estado === 'confirmada' || cita.estado === 'hecha') {
      res.status(200).send(pagina({ titulo: 'Cita ya confirmada', mensaje: 'Tu cita ya estaba confirmada. ¡Te esperamos!', detalle: cuando }));
      return;
    }
    await sql`UPDATE citas SET estado = 'confirmada' WHERE id = ${c}`;
    res.status(200).send(pagina({ titulo: '¡Cita confirmada!', mensaje: 'Tu reunión queda confirmada. Te enviaremos un recordatorio antes.', detalle: cuando }));
  } catch (err) {
    console.error(err);
    res.status(500).send(pagina({ titulo: 'Error temporal', mensaje: 'No se pudo confirmar ahora mismo. Inténtalo de nuevo en unos minutos.', color: '#c0392b' }));
  }
}
