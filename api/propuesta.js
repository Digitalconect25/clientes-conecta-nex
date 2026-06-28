// Endpoint PUBLICO de la propuesta (sin login). Accesible por token (del email).
//   GET  /api/propuesta?token=...                      -> datos para verla (marca 'vista')
//   POST /api/propuesta?token=...  { accion:'aceptar', nombre }  -> acepta + evidencia
//   POST /api/propuesta?token=...  { accion:'rechazar' }         -> rechaza
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

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
        await avisarAgencia(pr, 'rechazada').catch(() => {});
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
        if (row.prospecto_id) {
          try { await sql`UPDATE prospectos SET observaciones = COALESCE(observaciones,'') || ${'\n[Propuesta ' + (row.numero || '') + ' ACEPTADA: ' + EUR(row.total) + ' por ' + nombre + ']'}, prioridad = 'Alta', actualizado_en = NOW() WHERE id = ${row.prospecto_id}`; } catch { /* noop */ }
        }
        // Fase D: crea el cliente con los servicios aceptados y le pide los datos fiscales.
        // AWAIT: en serverless el trabajo async no garantiza completarse tras responder.
        await crearClienteYpedirDatos(row).catch((e) => console.error('faseD:', e.message));
        await acuseCliente(row).catch((e) => console.error('acuse:', e.message));
        await avisarAgencia(row, 'aceptada').catch(() => {});
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

// Fase D: al aceptar, crea el cliente desde el prospecto con los servicios aceptados
// y le envia el formulario de datos fiscales. Best-effort, no bloquea la aceptacion.
async function crearClienteYpedirDatos(pr) {
  if (!pr || pr.cliente_id) return;
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_token TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_estado TEXT DEFAULT 'pendiente'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_completados_en TIMESTAMPTZ`; } catch { /* noop */ }

  let prospecto = null;
  if (pr.prospecto_id) [prospecto] = await sql`SELECT * FROM prospectos WHERE id = ${pr.prospecto_id}`;
  if (prospecto?.cliente_id) { await sql`UPDATE propuestas SET cliente_id = ${prospecto.cliente_id} WHERE id = ${pr.id}`; return; }

  const items = Array.isArray(pr.items_json) ? pr.items_json : [];
  const servicios = items.map((it) => ({ nombre: it.nombre, precio: Number(it.precio || 0), cantidad: Number(it.cantidad || 1) }));
  const base = servicios.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const ivaImporte = Math.round(base * 0.21 * 100) / 100;
  const total = Math.round((base + ivaImporte) * 100) / 100;

  const anio = new Date().getFullYear();
  const [num] = await sql`INSERT INTO contadores (clave, valor) VALUES (${'cliente_' + anio}, 1)
    ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW() RETURNING valor`;
  const numeroCliente = `CL-${anio}-${String(num.valor).padStart(4, '0')}`;
  const nombreCli = (prospecto?.empresa || prospecto?.nombre || pr.destinatario_nombre || 'Cliente').trim();
  const notas = `Creado al aceptar la propuesta ${pr.numero || ''} (aceptada por ${pr.acept_nombre || ''}). Total propuesta: ${EUR(pr.total)}.` + (Number(pr.descuento) > 0 ? ` Incluye descuento de ${EUR(pr.descuento)}.` : '');

  const [cli] = await sql`
    INSERT INTO clientes (numero_cliente, estado, tipo_persona, nombre, nif, contacto, ciudad, email, telefono,
      servicios_json, iva, base_imponible, iva_importe, total, notas, estado_proyecto, porcentaje_avance, datos_estado)
    VALUES (${numeroCliente}, 'Pendiente firma', 'Fisica', ${nombreCli}, '', ${prospecto?.nombre || ''}, ${prospecto?.ciudad || ''},
      ${prospecto?.email || pr.destinatario_email || ''}, ${prospecto?.telefono || ''},
      ${JSON.stringify(servicios)}::jsonb, 21, ${base}, ${ivaImporte}, ${total}, ${notas}, 'Sin iniciar', 0, 'pendiente')
    RETURNING id, nombre, email`;

  await sql`UPDATE propuestas SET cliente_id = ${cli.id} WHERE id = ${pr.id}`;
  if (pr.prospecto_id) { try { await sql`UPDATE prospectos SET cliente_id = ${cli.id}, estado = 'convertido', actualizado_en = NOW() WHERE id = ${pr.prospecto_id}`; } catch { /* noop */ } }

  const email = (cli.email || '').trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && emailHabilitado()) {
    const tok = crypto.randomBytes(24).toString('base64url');
    await sql`UPDATE clientes SET datos_token = ${tok}, datos_estado = 'enviado' WHERE id = ${cli.id}`;
    const url = `${BASE}/datos-fiscales/${tok}`;
    const cuerpo = `
      <p style="margin:0 0 14px">Hola ${escEmail(cli.nombre || '')},</p>
      <p style="margin:0 0 16px">¡Gracias por aceptar la propuesta! Para preparar tu contrato solo necesitamos tus <b>datos fiscales</b> (y, si quieres, una foto de tu DNI/CIF). Es un minuto:</p>
      ${botonEmail(url, 'Completar mis datos fiscales')}
      <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">Después te enviaremos el contrato para firmarlo online. Si tienes dudas, responde a este correo.</p>
      <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
    await enviarEmail({ to: email, subject: 'Siguiente paso: tus datos para el contrato · Conecta NEX', html: envolverEmail({ titulo: 'Vamos a preparar tu contrato', preheader: 'Completa tus datos fiscales.', cuerpoHtml: cuerpo }), replyTo: process.env.REPLY_TO_EMAIL });
  }
}
