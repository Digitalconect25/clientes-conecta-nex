// Endpoint PUBLICO de la propuesta (sin login). Accesible por token (del email).
//   GET  /api/propuesta?token=...                      -> datos para verla (marca 'vista')
//   POST /api/propuesta?token=...  { accion:'aceptar', nombre }  -> acepta + evidencia
//   POST /api/propuesta?token=...  { accion:'rechazar' }         -> rechaza
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const EUR = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ¿Caducada? (enviada hace más de validez_dias y aún sin aceptar/rechazar)
function caducada(pr) {
  if (!pr.enviada_en || ['aceptada', 'rechazada'].includes(pr.estado)) return false;
  const limite = new Date(pr.enviada_en).getTime() + (Number(pr.validez_dias || 15) * 86400000);
  return Date.now() > limite;
}

// Vista pública (no exponemos campos internos).
function publica(pr) {
  return {
    numero: pr.numero, titulo: pr.titulo, intro: pr.intro,
    items: pr.items_json || [], descuento: Number(pr.descuento || 0), total: Number(pr.total || 0),
    notas: pr.notas, validez_dias: pr.validez_dias, estado: pr.estado,
    destinatario_nombre: pr.destinatario_nombre,
    enviada_en: pr.enviada_en, aceptada_en: pr.aceptada_en, acept_nombre: pr.acept_nombre,
  };
}

export default async function handler(req, res) {
  try {
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [pr] = await sql`SELECT * FROM propuestas WHERE token = ${tok}`;
    if (!pr) return jsonResponse(res, 404, { error: 'Propuesta no encontrada' });

    if (req.method === 'GET') {
      if (caducada(pr)) {
        await sql`UPDATE propuestas SET estado = 'caducada', actualizado_en = NOW() WHERE id = ${pr.id} AND estado NOT IN ('aceptada','rechazada')`;
        pr.estado = 'caducada';
      } else if (pr.estado === 'enviada') {
        await sql`UPDATE propuestas SET estado = 'vista', vista_en = COALESCE(vista_en, NOW()), actualizado_en = NOW() WHERE id = ${pr.id}`;
        pr.estado = 'vista';
      }
      return jsonResponse(res, 200, publica(pr));
    }

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'propuesta', 10, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const accion = String(req.body?.accion || '');

      if (['aceptada', 'rechazada'].includes(pr.estado)) {
        return jsonResponse(res, 409, { error: 'Esta propuesta ya está ' + pr.estado + '.', estado: pr.estado });
      }
      if (caducada(pr)) {
        await sql`UPDATE propuestas SET estado = 'caducada' WHERE id = ${pr.id}`;
        return jsonResponse(res, 410, { error: 'Esta propuesta ha caducado. Escríbenos y te preparamos una nueva.' });
      }

      if (accion === 'rechazar') {
        await sql`UPDATE propuestas SET estado = 'rechazada', rechazada_en = NOW(), actualizado_en = NOW() WHERE id = ${pr.id}`;
        avisarAgencia(pr, 'rechazada').catch(() => {});
        return jsonResponse(res, 200, { ok: true, estado: 'rechazada' });
      }

      if (accion === 'aceptar') {
        const nombre = String(req.body?.nombre || '').trim();
        if (nombre.length < 3) return jsonResponse(res, 400, { error: 'Escribe tu nombre y apellidos para aceptar.' });
        const ip = obtenerIp(req);
        const ua = String(req.headers['user-agent'] || '').slice(0, 300);
        const [row] = await sql`UPDATE propuestas SET
            estado = 'aceptada', aceptada_en = NOW(), acept_nombre = ${nombre}, acept_ip = ${ip}, acept_user_agent = ${ua}, actualizado_en = NOW()
          WHERE id = ${pr.id} RETURNING *`;
        // Acuse al cliente + aviso a la agencia (no bloquean la aceptación).
        acuseCliente(row).catch(() => {});
        avisarAgencia(row, 'aceptada').catch(() => {});
        if (row.prospecto_id) {
          try { await sql`UPDATE prospectos SET observaciones = COALESCE(observaciones,'') || ${'\n[Propuesta ' + (row.numero || '') + ' ACEPTADA: ' + EUR(row.total) + ' por ' + nombre + ']'}, prioridad = 'Alta', actualizado_en = NOW() WHERE id = ${row.prospecto_id}`; } catch { /* noop */ }
        }
        return jsonResponse(res, 200, { ok: true, estado: 'aceptada' });
      }

      return jsonResponse(res, 400, { error: 'Acción no válida' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('propuesta pública error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}

async function acuseCliente(pr) {
  if (!pr.destinatario_email || !emailHabilitado()) return;
  const cuerpo = `
    <p style="margin:0 0 14px">Hola ${escEmail(pr.acept_nombre || pr.destinatario_nombre || '')},</p>
    <p style="margin:0 0 16px">Hemos registrado tu <b>aceptación</b> de la propuesta. ¡Gracias por confiar en nosotros! En breve nos ponemos en contacto contigo para arrancar.</p>
    ${tarjetaDatos([['Propuesta', escEmail(pr.numero || '')], ['Importe', EUR(pr.total)], ['Aceptada por', escEmail(pr.acept_nombre || '')]])}
    <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  await enviarEmail({
    to: pr.destinatario_email,
    subject: `Propuesta ${pr.numero || ''} aceptada · Conecta NEX`,
    html: envolverEmail({ titulo: 'Propuesta aceptada', preheader: 'Gracias, lo tenemos todo registrado.', cuerpoHtml: cuerpo }),
    replyTo: process.env.REPLY_TO_EMAIL,
  });
}

async function avisarAgencia(pr, tipo) {
  const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
  const destino = process.env.AGENCY_EMAIL || em?.email;
  if (!destino || !emailHabilitado()) return;
  const ok = tipo === 'aceptada';
  const cuerpo = `<div style="font-family:Arial,sans-serif;color:#222">
    <h2 style="margin:0 0 8px;color:${ok ? '#0c7b6d' : '#b8860b'}">Propuesta ${escEmail(pr.numero || '')} ${ok ? 'ACEPTADA ✓' : 'rechazada'}</h2>
    <p>${escEmail(pr.destinatario_nombre || '')} · ${escEmail(pr.destinatario_email || '')}</p>
    <p>Importe: <b>${EUR(pr.total)}</b></p>
    ${ok ? `<p style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:10px">Aceptada por <b>${escEmail(pr.acept_nombre || '')}</b><br>Fecha (servidor): ${escEmail(String(pr.aceptada_en || ''))}<br>IP: ${escEmail(pr.acept_ip || '')}</p><p>Siguiente paso: convertir el lead en cliente con estos servicios.</p>` : ''}
    <p style="color:#999;font-size:12px">Panel: <a href="${BASE}/prospeccion">Prospección</a></p></div>`;
  await enviarEmail({ to: destino, subject: `${ok ? '🟢' : '🟠'} Propuesta ${pr.numero || ''} ${ok ? 'aceptada' : 'rechazada'} — ${EUR(pr.total)}`, html: cuerpo });
}
