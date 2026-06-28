// Endpoint PUBLICO: la EMPRESA valida el contrato ya firmado por el cliente,
// con un codigo que recibe por email. Al validar, queda firmado por ambas partes
// y se da por iniciado el encargo.
//   GET  /api/validar?token=<validacion_token>   -> datos para la pagina
//   POST /api/validar?token=...  { codigo }       -> valida y arranca el encargo
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, tarjetaDatos, escEmail } from './_emailLayout.js';
import { asegurarColumnas } from './documentos.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

function publico(doc, clienteNombre) {
  return {
    nombre: doc.nombre, cliente_nombre: clienteNombre || '',
    firmante_nombre: doc.firmante_nombre || '', fecha_firma: doc.fecha_firma, firma_ref: doc.firma_ref || '',
    validado: !!doc.validado_agencia_en,
  };
}

export default async function handler(req, res) {
  try {
    await asegurarColumnas();
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [doc] = await sql`SELECT * FROM documentos WHERE validacion_token = ${tok}`;
    if (!doc) return jsonResponse(res, 404, { error: 'Enlace de validación no válido.' });
    const [cli] = await sql`SELECT id, nombre, email FROM clientes WHERE id = ${doc.cliente_id}`;

    if (req.method === 'GET') return jsonResponse(res, 200, publico(doc, cli?.nombre));

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'validar', 10, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      if (doc.validado_agencia_en) return jsonResponse(res, 200, { ok: true, estado: 'validado', ya: true });
      const codigo = String(req.body?.codigo || '').trim();
      if (!doc.validacion_codigo) return jsonResponse(res, 400, { error: 'No hay código de validación para este contrato.' });
      if (codigo !== doc.validacion_codigo) return jsonResponse(res, 400, { error: 'El código no es correcto.' });
      if (doc.validacion_codigo_exp && new Date(doc.validacion_codigo_exp) < new Date()) return jsonResponse(res, 400, { error: 'El código ha caducado.' });

      await sql`UPDATE documentos SET validado_agencia_en = NOW(), firma_estado = 'validado', validacion_codigo = NULL WHERE id = ${doc.id}`;
      // El encargo queda iniciado.
      try { await sql`UPDATE clientes SET estado = 'Firmado', estado_proyecto = 'En curso', fecha_inicio = COALESCE(fecha_inicio, CURRENT_DATE), actualizado_en = NOW() WHERE id = ${doc.cliente_id}`; } catch { /* noop */ }

      // Confirmacion a ambas partes.
      if (emailHabilitado()) {
        const cuerpoCli = `<p style="margin:0 0 14px">Hola ${escEmail(cli?.nombre || '')},</p>
          <p style="margin:0 0 16px">Tu contrato <b>${escEmail(doc.nombre)}</b> queda <b>firmado y validado por ambas partes</b>. ¡Empezamos con tu encargo! En breve te contamos los siguientes pasos.</p>
          ${tarjetaDatos([['Documento', escEmail(doc.nombre)], ['Nº de validación', escEmail(doc.firma_ref || '')]])}
          <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
        if (cli?.email) { try { await enviarEmail({ to: cli.email, subject: `Contrato validado — empezamos · Conecta NEX`, html: envolverEmail({ titulo: 'Contrato validado', preheader: 'Firmado por ambas partes; arrancamos.', cuerpoHtml: cuerpoCli }), replyTo: process.env.REPLY_TO_EMAIL }); } catch { /* noop */ } }
        const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
        const destino = process.env.AGENCY_EMAIL || em?.email;
        if (destino) { try { await enviarEmail({ to: destino, subject: `✅ Contrato VALIDADO — ${escEmail(cli?.nombre || '')}`, html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="color:#0c7b6d">Contrato validado por la empresa</h2><p>${escEmail(doc.nombre)} · cliente ${escEmail(cli?.nombre || '')}</p><p>El encargo queda iniciado (proyecto En curso). <a href="${BASE}/clientes/${doc.cliente_id}">Ficha del cliente</a></p></div>` }); } catch { /* noop */ } }
      }
      return jsonResponse(res, 200, { ok: true, estado: 'validado' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('validar error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}
