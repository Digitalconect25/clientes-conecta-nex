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
import { generarPorTipo } from '../src/lib/contratos.js';

export const config = { api: { bodyParser: { sizeLimit: '9mb' } } };

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MARCAR_CLIENTE = ['contrato', 'hoja', 'paquete']; // tipos que dejan al cliente como "Firmado"
const TIPOS_DOC_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const maskEmail = (e) => { const [u, d] = String(e).split('@'); return (u ? u.slice(0, 2) + '***' : '') + '@' + (d || ''); };

// Adjunto HTML del documento firmado (justificante para ambas partes).
function adjuntoFirmado(html) {
  return { filename: 'contrato-firmado.html', content: Buffer.from(String(html || ''), 'utf-8').toString('base64'), content_type: 'text/html; charset=UTF-8' };
}

// Bloque de evidencia de firma electronica que se incrusta al final del documento firmado.
function bloqueEvidencia({ nombre, ref, fechaIso, ip, hash }) {
  let fecha = fechaIso;
  try { fecha = new Date(fechaIso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }); } catch { /* noop */ }
  return `<div style="margin-top:34px;padding:16px;border:1px solid #cfe9d8;background:#f0fdf4;border-radius:8px;font-size:9pt;color:#222;line-height:1.55;page-break-inside:avoid">
    <div style="font-weight:bold;color:#047857;margin-bottom:6px">EVIDENCIA DE FIRMA ELECTRONICA</div>
    Documento firmado electronicamente por <strong>${nombre}</strong>.<br>
    Fecha y hora (servidor): ${fecha}<br>
    Verificacion: codigo de un solo uso enviado al email del firmante e introducido correctamente.<br>
    Direccion IP del firmante: ${ip}<br>
    Numero de validacion: <strong>${ref}</strong><br>
    Integridad del documento (huella SHA-256): <code style="font-size:8pt;word-break:break-all">${hash}</code><br>
    <span style="color:#555">Firma electronica simple con evidencias conforme al Reglamento (UE) 910/2014 (eIDAS) y a la Ley 6/2020. Este registro (identidad declarada, verificacion por codigo al email, fecha de servidor, IP y huella criptografica) acredita el consentimiento del firmante y la integridad del documento.</span>
  </div>`;
}

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
    const [cli] = await sql`SELECT nombre, doc_identidad FROM clientes WHERE id = ${doc.cliente_id}`;

    if (req.method === 'GET') {
      if (doc.firma_estado === 'enviado' && !doc.firmado) {
        await sql`UPDATE documentos SET firma_estado = 'visto', firma_vista_en = COALESCE(firma_vista_en, NOW()) WHERE id = ${doc.id}`;
        doc.firma_estado = 'visto';
      }
      return jsonResponse(res, 200, { ...publico(doc, cli?.nombre), tiene_doc: !!cli?.doc_identidad });
    }

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'firmar', 12, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const accion = String(req.body?.accion || '');

      if (doc.firmado && accion !== 'guardar_pdf') return jsonResponse(res, 409, { error: 'Este documento ya está firmado.', firmado: true });

      // Envia un codigo de un solo uso (OTP) al email del firmante para validar la firma.
      if (accion === 'enviar_codigo') {
        const email = String(doc.firmante_email || '').trim();
        if (!email || !RE_EMAIL.test(email)) return jsonResponse(res, 400, { error: 'No hay un email válido para enviarte el código.' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Envío de código no disponible.' });
        const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await sql`UPDATE documentos SET firma_codigo = ${codigo}, firma_codigo_exp = NOW() + INTERVAL '15 minutes' WHERE id = ${doc.id}`;
        const cuerpo = `<p style="margin:0 0 14px">Hola ${escEmail(cli?.nombre || '')},</p>
          <p style="margin:0 0 12px">Tu <b>código de firma</b> para el documento <b>${escEmail(doc.nombre)}</b> es:</p>
          <div style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0c7b6d;text-align:center;background:#f0fdf4;border:1px solid #cfe9d8;border-radius:10px;padding:16px;margin:6px 0 14px">${codigo}</div>
          <p style="margin:0;color:#707a83;font-size:13.5px">Válido 15 minutos. Introdúcelo en la página de firma para completar tu firma. Si no lo has solicitado, ignora este correo.</p>`;
        await enviarEmail({ to: email, subject: `Tu código de firma: ${codigo} · Conecta NEX`, html: envolverEmail({ titulo: 'Código de firma', preheader: 'Tu código para firmar el documento.', cuerpoHtml: cuerpo }), replyTo: process.env.REPLY_TO_EMAIL });
        return jsonResponse(res, 200, { ok: true, email: maskEmail(email) });
      }

      if (accion === 'rechazar') {
        await sql`UPDATE documentos SET firma_estado = 'rechazado' WHERE id = ${doc.id}`;
        await avisarAgencia(doc, cli?.nombre, 'rechazado').catch(() => {});
        return jsonResponse(res, 200, { ok: true, estado: 'rechazado' });
      }

      if (accion === 'firmar') {
        const nombre = String(req.body?.nombre || '').trim();
        if (nombre.length < 3) return jsonResponse(res, 400, { error: 'Escribe tu nombre y apellidos para firmar.' });
        if (req.body?.acepto !== true) return jsonResponse(res, 400, { error: 'Marca la casilla de que has leído y aceptas el documento.' });
        const codigo = String(req.body?.codigo || '').trim();
        if (!doc.firma_codigo) return jsonResponse(res, 400, { error: 'Primero pide tu código de firma por email.' });
        if (codigo !== doc.firma_codigo) return jsonResponse(res, 400, { error: 'El código no es correcto. Revísalo o pide uno nuevo.' });
        if (doc.firma_codigo_exp && new Date(doc.firma_codigo_exp) < new Date()) return jsonResponse(res, 400, { error: 'El código ha caducado. Pide uno nuevo.' });
        const firmaImg = String(req.body?.firma_img || '');
        if (!/^data:image\/png;base64,/.test(firmaImg) || firmaImg.length < 200) return jsonResponse(res, 400, { error: 'Falta tu firma. Dibújala con el dedo o el ratón en el recuadro.' });

        const ip = obtenerIp(req);
        const ua = String(req.headers['user-agent'] || '').slice(0, 300);
        const ref = 'CNX-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${doc.cliente_id}`;
        const [em] = await sql`SELECT * FROM emisor WHERE id = 1`;
        let base = '';
        try { base = generarPorTipo(doc.tipo, cliente || {}, em || {}, firmaImg); } catch { base = doc.contenido_html || ''; }
        const hash = crypto.createHash('sha256').update(base).digest('hex');
        const firmadoHtml = base + bloqueEvidencia({ nombre, ref, fechaIso: new Date().toISOString(), ip, hash });

        const [row] = await sql`UPDATE documentos SET
            firmado = TRUE, fecha_firma = NOW(), firma_estado = 'firmado',
            firmante_nombre = ${nombre}, firmante_ip = ${ip}, firmante_user_agent = ${ua},
            firma_hash = ${hash}, firma_img = ${firmaImg}, firma_ref = ${ref}, contenido_html = ${firmadoHtml}, firma_codigo = NULL
          WHERE id = ${doc.id} RETURNING *`;

        // DNI/NIE/Pasaporte/CIF opcional adjuntado al firmar.
        if (req.body?.doc_base64) {
          const t = String(req.body.doc_tipo || 'application/octet-stream');
          const buf = Buffer.from(String(req.body.doc_base64), 'base64');
          if (TIPOS_DOC_OK.includes(t) && buf.length > 0 && buf.length <= 8 * 1024 * 1024) {
            try { await sql`INSERT INTO archivos (cliente_id, nombre, tipo, tamano, contenido) VALUES (${doc.cliente_id}, ${String(req.body.doc_nombre || 'Documento identidad ' + nombre).slice(0, 180)}, ${t}, ${buf.length}, ${buf})`; await sql`UPDATE clientes SET doc_identidad = TRUE WHERE id = ${doc.cliente_id}`; } catch (e) { console.error('doc firma:', e.message); }
          }
        }
        if (MARCAR_CLIENTE.includes(doc.tipo)) {
          try { await sql`UPDATE clientes SET estado = 'Firmado', fecha_firma = NOW(), actualizado_en = NOW() WHERE id = ${doc.cliente_id}`; } catch { /* noop */ }
        }
        await acuseCliente(row, cli?.nombre, firmadoHtml).catch((e) => console.error('acuse firma:', e.message));
        await avisarAgencia(row, cli?.nombre, 'firmado', firmadoHtml).catch(() => {});
        return jsonResponse(res, 200, { ok: true, estado: 'firmado', firmante: nombre, ref, signed_html: firmadoHtml });
      }

      // El navegador del cliente genera el PDF del documento firmado y lo guarda en el CRM.
      if (accion === 'guardar_pdf') {
        const b64 = String(req.body?.pdf_base64 || '');
        if (!b64) return jsonResponse(res, 400, { error: 'Falta el PDF' });
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 100 || buf.length > 12 * 1024 * 1024) return jsonResponse(res, 400, { error: 'PDF no válido' });
        const nom = `Contrato firmado ${doc.firma_ref || ''} - ${doc.nombre}.pdf`.slice(0, 180);
        try { await sql`INSERT INTO archivos (cliente_id, nombre, tipo, tamano, contenido) VALUES (${doc.cliente_id}, ${nom}, ${'application/pdf'}, ${buf.length}, ${buf})`; } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
        return jsonResponse(res, 200, { ok: true });
      }

      return jsonResponse(res, 400, { error: 'Acción no válida' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('firmar público error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}

async function acuseCliente(doc, clienteNombre, adjuntoHtml) {
  if (!doc.firmante_email || !emailHabilitado()) return;
  const cuerpo = `
    <p style="margin:0 0 14px">Hola ${escEmail(doc.firmante_nombre || clienteNombre || '')},</p>
    <p style="margin:0 0 16px">Hemos registrado tu <b>firma</b>. Te adjuntamos el <b>documento firmado</b> (incluye la Hoja de Encargo, el Contrato de Encargo de Tratamiento de datos y el Contrato de Servicios). Guárdalo como justificante.</p>
    ${tarjetaDatos([['Documento', escEmail(doc.nombre)], ['Firmado por', escEmail(doc.firmante_nombre || '')], ['Nº de validación', escEmail(doc.firma_ref || '')], ['Fecha', escEmail(String(doc.fecha_firma || '').slice(0, 16).replace('T', ' '))]])}
    <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  await enviarEmail({
    to: doc.firmante_email,
    subject: `Tu contrato firmado: ${doc.nombre} · Conecta NEX`,
    html: envolverEmail({ titulo: 'Tu contrato firmado', preheader: 'Adjunto el documento firmado, guárdalo.', cuerpoHtml: cuerpo }),
    attachments: adjuntoHtml ? [adjuntoFirmado(adjuntoHtml)] : undefined,
    replyTo: process.env.REPLY_TO_EMAIL,
  });
}

async function avisarAgencia(doc, clienteNombre, tipo, adjuntoHtml) {
  const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
  const destino = process.env.AGENCY_EMAIL || em?.email;
  if (!destino || !emailHabilitado()) return;
  const ok = tipo === 'firmado';
  const html = `<div style="font-family:Arial,sans-serif;color:#222">
    <h2 style="margin:0 0 8px;color:${ok ? '#0c7b6d' : '#b8860b'}">${escEmail(doc.nombre)} ${ok ? 'FIRMADO ✓' : 'rechazado'}</h2>
    <p>Cliente: ${escEmail(clienteNombre || '')}</p>
    ${ok ? `<p style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:10px">Firmado por <b>${escEmail(doc.firmante_nombre || '')}</b><br>Nº de validación: <b>${escEmail(doc.firma_ref || '')}</b><br>Fecha (servidor): ${escEmail(String(doc.fecha_firma || ''))}<br>IP: ${escEmail(doc.firmante_ip || '')}<br>Hash SHA-256: <code style="font-size:11px">${escEmail(doc.firma_hash || '')}</code></p><p>Adjunto el documento firmado (copia para el expediente).</p>` : ''}
    <p style="color:#999;font-size:12px">Panel: <a href="${BASE}/clientes/${doc.cliente_id}">ficha del cliente</a></p></div>`;
  await enviarEmail({ to: destino, subject: `${ok ? '🟢' : '🟠'} ${doc.nombre} ${ok ? 'firmado' : 'rechazado'} — ${escEmail(clienteNombre || '')}`, html, attachments: ok && adjuntoHtml ? [adjuntoFirmado(adjuntoHtml)] : undefined });
}
