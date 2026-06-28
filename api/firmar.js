// Endpoint PUBLICO de firma remota del documento (sin login). Por token (del email).
//   GET  /api/firmar?token=...                          -> documento para verlo (marca 'visto')
//   POST /api/firmar?token=...  { accion:'firmar', nombre, acepto } -> firma + evidencia
//   POST /api/firmar?token=...  { accion:'rechazar' }               -> rechaza
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, tarjetaDatos, escEmail } from './_emailLayout.js';
import { asegurarColumnas } from './documentos.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MARCAR_CLIENTE = ['contrato', 'hoja']; // tipos que dejan al cliente como "Firmado"

function publico(doc, clienteNombre) {
  return {
    tipo: doc.tipo, nombre: doc.nombre, contenido_html: doc.contenido_html || '',
    cliente_nombre: clienteNombre || '', firma_estado: doc.firma_estado || 'enviado',
    firmado: !!doc.firmado, firmante_nombre: doc.firmante_nombre || '', fecha_firma: doc.fecha_firma,
  };
}

export default async function handler(req, res) {
  try {
    await asegurarColumnas();
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [doc] = await sql`SELECT * FROM documentos WHERE firma_token = ${tok}`;
    if (!doc) return jsonResponse(res, 404, { error: 'Documento no encontrado o enlace caducado.' });
    const [cli] = await sql`SELECT nombre FROM clientes WHERE id = ${doc.cliente_id}`;

    if (req.method === 'GET') {
      if (doc.firma_estado === 'enviado' && !doc.firmado) {
        await sql`UPDATE documentos SET firma_estado = 'visto', firma_vista_en = COALESCE(firma_vista_en, NOW()) WHERE id = ${doc.id}`;
        doc.firma_estado = 'visto';
      }
      return jsonResponse(res, 200, publico(doc, cli?.nombre));
    }

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'firmar', 8, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const accion = String(req.body?.accion || '');

      if (doc.firmado) return jsonResponse(res, 409, { error: 'Este documento ya está firmado.', firmado: true });

      if (accion === 'rechazar') {
        await sql`UPDATE documentos SET firma_estado = 'rechazado' WHERE id = ${doc.id}`;
        await avisarAgencia(doc, cli?.nombre, 'rechazado').catch(() => {});
        return jsonResponse(res, 200, { ok: true, estado: 'rechazado' });
      }

      if (accion === 'firmar') {
        const nombre = String(req.body?.nombre || '').trim();
        if (nombre.length < 3) return jsonResponse(res, 400, { error: 'Escribe tu nombre y apellidos para firmar.' });
        if (req.body?.acepto !== true) return jsonResponse(res, 400, { error: 'Marca la casilla de que has leído y aceptas el documento.' });
        const ip = obtenerIp(req);
        const ua = String(req.headers['user-agent'] || '').slice(0, 300);
        const hash = crypto.createHash('sha256').update(String(doc.contenido_html || '')).digest('hex');
        const [row] = await sql`UPDATE documentos SET
            firmado = TRUE, fecha_firma = NOW(), firma_estado = 'firmado',
            firmante_nombre = ${nombre}, firmante_ip = ${ip}, firmante_user_agent = ${ua}, firma_hash = ${hash}
          WHERE id = ${doc.id} RETURNING *`;
        if (MARCAR_CLIENTE.includes(doc.tipo)) {
          try { await sql`UPDATE clientes SET estado = 'Firmado', fecha_firma = NOW(), actualizado_en = NOW() WHERE id = ${doc.cliente_id}`; } catch { /* noop */ }
        }
        await acuseCliente(row, cli?.nombre).catch((e) => console.error('acuse firma:', e.message));
        await avisarAgencia(row, cli?.nombre, 'firmado').catch(() => {});
        return jsonResponse(res, 200, { ok: true, estado: 'firmado', firmante: nombre });
      }

      return jsonResponse(res, 400, { error: 'Acción no válida' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('firmar público error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}

async function acuseCliente(doc, clienteNombre) {
  if (!doc.firmante_email || !emailHabilitado()) return;
  const cuerpo = `
    <p style="margin:0 0 14px">Hola ${escEmail(doc.firmante_nombre || clienteNombre || '')},</p>
    <p style="margin:0 0 16px">Hemos registrado tu <b>firma</b> del documento <b>${escEmail(doc.nombre)}</b>. ¡Gracias! Guarda este correo como justificante.</p>
    ${tarjetaDatos([['Documento', escEmail(doc.nombre)], ['Firmado por', escEmail(doc.firmante_nombre || '')], ['Fecha', escEmail(String(doc.fecha_firma || '').slice(0, 16).replace('T', ' '))]])}
    <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  await enviarEmail({
    to: doc.firmante_email,
    subject: `Documento firmado: ${doc.nombre} · Conecta NEX`,
    html: envolverEmail({ titulo: 'Documento firmado', preheader: 'Justificante de tu firma.', cuerpoHtml: cuerpo }),
    replyTo: process.env.REPLY_TO_EMAIL,
  });
}

async function avisarAgencia(doc, clienteNombre, tipo) {
  const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
  const destino = process.env.AGENCY_EMAIL || em?.email;
  if (!destino || !emailHabilitado()) return;
  const ok = tipo === 'firmado';
  const html = `<div style="font-family:Arial,sans-serif;color:#222">
    <h2 style="margin:0 0 8px;color:${ok ? '#0c7b6d' : '#b8860b'}">${escEmail(doc.nombre)} ${ok ? 'FIRMADO ✓' : 'rechazado'}</h2>
    <p>Cliente: ${escEmail(clienteNombre || '')}</p>
    ${ok ? `<p style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:10px">Firmado por <b>${escEmail(doc.firmante_nombre || '')}</b><br>Fecha (servidor): ${escEmail(String(doc.fecha_firma || ''))}<br>IP: ${escEmail(doc.firmante_ip || '')}<br>Hash SHA-256: <code style="font-size:11px">${escEmail(doc.firma_hash || '')}</code></p>` : ''}
    <p style="color:#999;font-size:12px">Panel: <a href="${BASE}/clientes/${doc.cliente_id}">ficha del cliente</a></p></div>`;
  await enviarEmail({ to: destino, subject: `${ok ? '🟢' : '🟠'} ${doc.nombre} ${ok ? 'firmado' : 'rechazado'} — ${escEmail(clienteNombre || '')}`, html });
}
