// Endpoint PUBLICO de la ficha de implementacion (sin login, por token del email).
//   GET  /api/ficha?token=...                                  -> ficha para rellenar (marca 'vista')
//   POST /api/ficha?token=...  { accion:'guardar', contenido }          -> guarda borrador (sin validar)
//   POST /api/ficha?token=...  { accion:'enviar', contenido }           -> valida obligatorios y pasa a 'completada'
//   POST /api/ficha?token=...  { accion:'enviar_codigo', firmante_email } -> envia OTP de firma
//   POST /api/ficha?token=...  { accion:'firmar', ... }                 -> firma + evidencia (hash/IP/ref)
//   POST /api/ficha?token=...  { accion:'guardar_pdf', pdf_base64 }     -> guarda el PDF en Archivos
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';
import { asegurarFichas } from './fichas.js';
import { seccionesActivas, camposFaltantes, renderFichaHtml } from '../src/lib/fichas.js';

export const config = { api: { bodyParser: { sizeLimit: '9mb' } } };

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS_DOC_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const maskEmail = (e) => { const [u, d] = String(e).split('@'); return (u ? u.slice(0, 2) + '***' : '') + '@' + (d || ''); };

function bloqueEvidencia({ nombre, ref, fechaIso, ip, hash }) {
  let fecha = fechaIso;
  try { fecha = new Date(fechaIso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }); } catch { /* noop */ }
  return `<div style="margin-top:34px;padding:16px;border:1px solid #cfe9d8;background:#f0fdf4;border-radius:8px;font-size:9pt;color:#222;line-height:1.55;page-break-inside:avoid">
    <div style="font-weight:bold;color:#047857;margin-bottom:6px">EVIDENCIA DE FIRMA ELECTRONICA</div>
    Ficha firmada electronicamente por <strong>${nombre}</strong>.<br>
    Fecha y hora (servidor): ${fecha}<br>
    Verificacion: codigo de un solo uso enviado al email del firmante e introducido correctamente.<br>
    Direccion IP del firmante: ${ip}<br>
    Numero de validacion: <strong>${ref}</strong><br>
    Integridad del documento (huella SHA-256): <code style="font-size:8pt;word-break:break-all">${hash}</code><br>
    <span style="color:#555">Firma electronica simple con evidencias conforme al Reglamento (UE) 910/2014 (eIDAS) y a la Ley 6/2020. Este registro (identidad declarada, verificacion por codigo al email, fecha de servidor, IP y huella criptografica) acredita el consentimiento del firmante y la integridad del documento.</span>
  </div>`;
}

function adjuntoFirmado(html, nombre) {
  return { filename: nombre || 'ficha-firmada.html', content: Buffer.from(String(html || ''), 'utf-8').toString('base64'), content_type: 'text/html; charset=UTF-8' };
}

function publico(f, clienteNombre) {
  return {
    titulo: f.titulo, version: f.version, secciones: f.secciones, contenido: f.contenido || {},
    estado: f.estado, cliente_nombre: clienteNombre || '',
    firmado: !!f.fecha_firma, firmante_nombre: f.firmante_nombre || '', fecha_firma: f.fecha_firma,
    firma_ref: f.firma_ref || '', validado: !!f.validado_en,
    contenido_html: f.contenido_html || '',
  };
}

export default async function handler(req, res) {
  try {
    await asegurarFichas();
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [f] = await sql`SELECT * FROM fichas WHERE token = ${tok}`;
    if (!f) return jsonResponse(res, 404, { error: 'Ficha no encontrada o enlace no válido.' });
    const [cli] = await sql`SELECT nombre, email, nif FROM clientes WHERE id = ${f.cliente_id}`;

    if (req.method === 'GET') {
      if (!f.vista_en) {
        f.vista_en = new Date().toISOString();
        if (f.estado === 'enviada') f.estado = 'en_progreso';
        await sql`UPDATE fichas SET vista_en = ${f.vista_en}, estado = ${f.estado} WHERE id = ${f.id}`;
      }
      return jsonResponse(res, 200, publico(f, cli?.nombre));
    }

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'ficha', 20, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const accion = String(req.body?.accion || '');

      if (['firmada', 'validada'].includes(f.estado) && accion !== 'guardar_pdf') {
        return jsonResponse(res, 409, { error: 'Esta ficha ya está firmada.', firmado: true });
      }

      // Guarda el progreso tal cual esta (sin validar campos obligatorios).
      if (accion === 'guardar') {
        const contenido = req.body?.contenido && typeof req.body.contenido === 'object' ? req.body.contenido : {};
        await sql`UPDATE fichas SET contenido = ${JSON.stringify(contenido)}::jsonb,
            estado = CASE WHEN estado IN ('borrador', 'enviada') THEN 'en_progreso' ELSE estado END,
            actualizado_en = NOW() WHERE id = ${f.id}`;
        return jsonResponse(res, 200, { ok: true });
      }

      // El cliente da la ficha por completa: valida obligatorios y desbloquea la firma.
      if (accion === 'enviar') {
        const contenido = req.body?.contenido && typeof req.body.contenido === 'object' ? req.body.contenido : (f.contenido || {});
        const faltan = camposFaltantes(f.secciones, contenido);
        if (faltan.length) return jsonResponse(res, 400, { error: 'Faltan campos obligatorios.', faltan });
        await sql`UPDATE fichas SET contenido = ${JSON.stringify(contenido)}::jsonb,
            estado = 'completada', completada_en = NOW(), actualizado_en = NOW() WHERE id = ${f.id}`;
        return jsonResponse(res, 200, { ok: true, estado: 'completada' });
      }

      if (f.estado !== 'completada' && ['enviar_codigo', 'firmar'].includes(accion)) {
        return jsonResponse(res, 400, { error: 'Primero completa todos los apartados obligatorios.' });
      }

      // Envia un codigo de un solo uso (OTP) al email de quien va a firmar.
      if (accion === 'enviar_codigo') {
        const email = String(req.body?.firmante_email || '').trim();
        if (!email || !RE_EMAIL.test(email)) return jsonResponse(res, 400, { error: 'Escribe un email válido para enviarte el código.' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Envío de código no disponible.' });
        const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await sql`UPDATE fichas SET firmante_email = ${email}, firma_codigo = ${codigo}, firma_codigo_exp = NOW() + INTERVAL '15 minutes' WHERE id = ${f.id}`;
        const cuerpo = `<p style="margin:0 0 14px">Hola,</p>
          <p style="margin:0 0 12px">Tu <b>código de firma</b> para la ficha <b>${escEmail(f.titulo)}</b> es:</p>
          <div style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0c7b6d;text-align:center;background:#f0fdf4;border:1px solid #cfe9d8;border-radius:10px;padding:16px;margin:6px 0 14px">${codigo}</div>
          <p style="margin:0;color:#707a83;font-size:13.5px">Válido 15 minutos. Introdúcelo en la página de la ficha para completar tu firma. Si no lo has solicitado, ignora este correo.</p>`;
        await enviarEmail({ to: email, subject: `Tu código de firma: ${codigo} · Conecta NEX`, html: envolverEmail({ titulo: 'Código de firma', preheader: 'Tu código para firmar la ficha.', cuerpoHtml: cuerpo }), replyTo: process.env.REPLY_TO_EMAIL });
        return jsonResponse(res, 200, { ok: true, email: maskEmail(email) });
      }

      if (accion === 'firmar') {
        const nombre = String(req.body?.firmante_nombre || '').trim();
        const nif = String(req.body?.firmante_nif || '').trim();
        const cargo = String(req.body?.firmante_cargo || '').trim();
        if (nombre.length < 3) return jsonResponse(res, 400, { error: 'Escribe el nombre y apellidos del representante.' });
        if (!nif) return jsonResponse(res, 400, { error: 'Falta el DNI o NIE del representante.' });
        const decl = req.body?.declaraciones || {};
        const REQUERIDAS = ['capacidad_representacion', 'aprueba_alcance', 'autoriza_tratamiento_operativo', 'recibe_copia'];
        if (REQUERIDAS.some((k) => decl[k] !== true)) return jsonResponse(res, 400, { error: 'Debes marcar las cuatro declaraciones del firmante antes de firmar.' });
        const codigo = String(req.body?.codigo || '').trim();
        if (!f.firma_codigo) return jsonResponse(res, 400, { error: 'Primero pide tu código de firma por email.' });
        if (codigo !== f.firma_codigo) return jsonResponse(res, 400, { error: 'El código no es correcto. Revísalo o pide uno nuevo.' });
        if (f.firma_codigo_exp && new Date(f.firma_codigo_exp) < new Date()) return jsonResponse(res, 400, { error: 'El código ha caducado. Pide uno nuevo.' });
        const firmaImg = String(req.body?.firma_img || '');
        if (!/^data:image\/png;base64,/.test(firmaImg) || firmaImg.length < 200) return jsonResponse(res, 400, { error: 'Falta tu firma. Dibújala con el dedo o el ratón en el recuadro.' });

        const metaFirma = {
          razon_social_cliente: String(req.body?.razon_social_cliente || '').slice(0, 200),
          cif_nif_cliente: String(req.body?.cif_nif_cliente || '').slice(0, 40),
          representante: nombre, dni_nie: nif, cargo,
          lugar: String(req.body?.lugar || '').slice(0, 120),
          funciones_aprobadas: String(req.body?.funciones_aprobadas || '').slice(0, 4000),
          pendientes_exclusiones: String(req.body?.pendientes_exclusiones || '').slice(0, 4000),
          declaraciones: { capacidad_representacion: true, aprueba_alcance: true, autoriza_tratamiento_operativo: true, recibe_copia: true },
        };
        const contenidoFirmado = { ...(f.contenido || {}), firma: metaFirma };

        const ip = obtenerIp(req);
        const ua = String(req.headers['user-agent'] || '').slice(0, 300);
        const ref = 'CNX-FICHA-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${f.cliente_id}`;
        const [emisor] = await sql`SELECT * FROM emisor WHERE id = 1`;

        let base = '';
        try {
          base = renderFichaHtml({ ...f, contenido: contenidoFirmado, firma_img: firmaImg, firmante_nombre: nombre, firmante_nif: nif }, cliente || {}, emisor || {}, { conFirma: true });
        } catch (e) { console.error('render ficha:', e.message); base = f.contenido_html || ''; }
        const hash = crypto.createHash('sha256').update(base).digest('hex');
        const firmadoHtml = base + bloqueEvidencia({ nombre, ref, fechaIso: new Date().toISOString(), ip, hash });

        const [row] = await sql`UPDATE fichas SET
            estado = 'firmada', fecha_firma = NOW(),
            firmante_nombre = ${nombre}, firmante_nif = ${nif}, firmante_cargo = ${cargo},
            firmante_ip = ${ip}, firmante_user_agent = ${ua},
            firma_hash = ${hash}, firma_img = ${firmaImg}, firma_ref = ${ref},
            contenido = ${JSON.stringify(contenidoFirmado)}::jsonb, contenido_html = ${firmadoHtml},
            firma_codigo = NULL, actualizado_en = NOW()
          WHERE id = ${f.id} RETURNING *`;

        await acuseFirmante(row, cliente?.nombre, firmadoHtml).catch((e) => console.error('acuse ficha:', e.message));
        await avisarAgencia(row, cliente?.nombre, firmadoHtml).catch((e) => console.error('aviso agencia ficha:', e.message));
        await solicitarValidacionAgencia(row, cliente?.nombre).catch((e) => console.error('validacion ficha:', e.message));

        return jsonResponse(res, 200, { ok: true, estado: 'firmada', firmante: nombre, ref, signed_html: firmadoHtml });
      }

      // El navegador del cliente genera el PDF de la ficha firmada y lo guarda en el CRM.
      if (accion === 'guardar_pdf') {
        const b64 = String(req.body?.pdf_base64 || '');
        if (!b64) return jsonResponse(res, 400, { error: 'Falta el PDF' });
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 100 || buf.length > 12 * 1024 * 1024) return jsonResponse(res, 400, { error: 'PDF no válido' });
        const nom = `Ficha implementación firmada ${f.firma_ref || ''} - ${cli?.nombre || ''}.pdf`.slice(0, 180);
        try { await sql`INSERT INTO archivos (cliente_id, nombre, tipo, tamano, contenido) VALUES (${f.cliente_id}, ${nom}, ${'application/pdf'}, ${buf.length}, ${buf})`; } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
        return jsonResponse(res, 200, { ok: true });
      }

      return jsonResponse(res, 400, { error: 'Acción no válida' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('ficha público error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}

async function acuseFirmante(f, clienteNombre, adjuntoHtml) {
  if (!f.firmante_email || !emailHabilitado()) return;
  const cuerpo = `
    <p style="margin:0 0 14px">Hola ${escEmail(f.firmante_nombre || clienteNombre || '')},</p>
    <p style="margin:0 0 16px">Hemos registrado tu <b>firma</b> de la ficha de implementación del agente IA. Te adjuntamos una copia. Guárdala como justificante.</p>
    ${tarjetaDatos([['Ficha', escEmail(f.titulo)], ['Firmado por', escEmail(f.firmante_nombre || '')], ['Nº de validación', escEmail(f.firma_ref || '')], ['Fecha', escEmail(String(f.fecha_firma || '').slice(0, 16).replace('T', ' '))]])}
    <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  await enviarEmail({
    to: f.firmante_email,
    subject: `Tu ficha firmada: ${f.titulo} · Conecta NEX`,
    html: envolverEmail({ titulo: 'Ficha firmada', preheader: 'Adjunto la copia, guárdala.', cuerpoHtml: cuerpo }),
    attachments: adjuntoHtml ? [adjuntoFirmado(adjuntoHtml, 'ficha-implementacion-firmada.html')] : undefined,
    replyTo: process.env.REPLY_TO_EMAIL,
  });
}

async function avisarAgencia(f, clienteNombre, adjuntoHtml) {
  const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
  const destino = process.env.AGENCY_EMAIL || em?.email;
  if (!destino || !emailHabilitado()) return;
  const html = `<div style="font-family:Arial,sans-serif;color:#222">
    <h2 style="margin:0 0 8px;color:#0c7b6d">${escEmail(f.titulo)} FIRMADA ✓</h2>
    <p>Cliente: ${escEmail(clienteNombre || '')}</p>
    <p style="background:#f0fdf4;border:1px solid #cfe9d8;border-radius:8px;padding:10px">Firmado por <b>${escEmail(f.firmante_nombre || '')}</b> (${escEmail(f.firmante_cargo || '')})<br>Nº de validación: <b>${escEmail(f.firma_ref || '')}</b><br>Fecha (servidor): ${escEmail(String(f.fecha_firma || ''))}<br>IP: ${escEmail(f.firmante_ip || '')}<br>Hash SHA-256: <code style="font-size:11px">${escEmail(f.firma_hash || '')}</code></p>
    <p>Pendiente de tu validación para dar por aprobado el alcance.</p>
    <p style="color:#999;font-size:12px">Panel: <a href="${BASE}/clientes/${f.cliente_id}">ficha del cliente</a></p></div>`;
  await enviarEmail({ to: destino, subject: `🟢 ${f.titulo} firmada — ${escEmail(clienteNombre || '')}`, html, attachments: adjuntoHtml ? [adjuntoFirmado(adjuntoHtml, 'ficha-implementacion-firmada.html')] : undefined });
}

// Tras firmar el cliente, se pide a la AGENCIA un codigo para validar la ficha (doble validacion).
async function solicitarValidacionAgencia(f, clienteNombre) {
  const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
  const destino = process.env.AGENCY_EMAIL || em?.email;
  if (!destino || !emailHabilitado()) return;
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const vtok = crypto.randomBytes(24).toString('base64url');
  await sql`UPDATE fichas SET validacion_token = ${vtok}, validacion_codigo = ${codigo}, validacion_codigo_exp = NOW() + INTERVAL '7 days' WHERE id = ${f.id}`;
  const url = `${BASE}/validar-ficha/${vtok}`;
  const cuerpo = `
    <p style="margin:0 0 14px">El cliente <b>${escEmail(clienteNombre || '')}</b> ha firmado la ficha <b>${escEmail(f.titulo)}</b>.</p>
    <p style="margin:0 0 12px">Para <b>validarla como agencia</b> y dar por aprobado el alcance, entra y mete este código:</p>
    <div style="font-size:28px;font-weight:800;letter-spacing:8px;color:#0c7b6d;text-align:center;background:#f0fdf4;border:1px solid #cfe9d8;border-radius:10px;padding:14px;margin:6px 0 12px">${codigo}</div>
    ${botonEmail(url, 'Validar la ficha')}
    <p style="margin:14px 0 0;color:#707a83;font-size:13px">Evidencia del cliente: nº de validación ${escEmail(f.firma_ref || '')} · IP ${escEmail(f.firmante_ip || '')}.</p>`;
  await enviarEmail({ to: destino, subject: `Valida la ficha firmada — ${escEmail(clienteNombre || '')} · Conecta NEX`, html: envolverEmail({ titulo: 'Valida la ficha', preheader: 'El cliente ha firmado; valida el alcance.', cuerpoHtml: cuerpo }), replyTo: process.env.REPLY_TO_EMAIL });
}
