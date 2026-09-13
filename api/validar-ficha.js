// Endpoint PUBLICO: la AGENCIA valida la ficha ya firmada por el cliente,
// con un codigo que recibe por email (doble validacion, igual que los contratos).
//   GET  /api/validar-ficha?token=<validacion_token>   -> datos para la pagina
//   POST /api/validar-ficha?token=...  { codigo }       -> valida la ficha
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, tarjetaDatos, escEmail } from './_emailLayout.js';
import { asegurarFichas } from './fichas.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

function publico(f, clienteNombre) {
  return {
    titulo: f.titulo, cliente_nombre: clienteNombre || '',
    firmante_nombre: f.firmante_nombre || '', fecha_firma: f.fecha_firma, firma_ref: f.firma_ref || '',
    validado: !!f.validado_en,
  };
}

export default async function handler(req, res) {
  try {
    await asegurarFichas();
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [f] = await sql`SELECT * FROM fichas WHERE validacion_token = ${tok}`;
    if (!f) return jsonResponse(res, 404, { error: 'Enlace de validación no válido.' });
    const [cli] = await sql`SELECT id, nombre, email FROM clientes WHERE id = ${f.cliente_id}`;

    if (req.method === 'GET') return jsonResponse(res, 200, publico(f, cli?.nombre));

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'validarficha', 10, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      if (f.validado_en) return jsonResponse(res, 200, { ok: true, estado: 'validada', ya: true });
      const codigo = String(req.body?.codigo || '').trim();
      if (!f.validacion_codigo) return jsonResponse(res, 400, { error: 'No hay código de validación para esta ficha.' });
      if (codigo !== f.validacion_codigo) return jsonResponse(res, 400, { error: 'El código no es correcto.' });
      if (f.validacion_codigo_exp && new Date(f.validacion_codigo_exp) < new Date()) return jsonResponse(res, 400, { error: 'El código ha caducado.' });

      await sql`UPDATE fichas SET validado_en = NOW(), estado = 'validada', validacion_codigo = NULL, actualizado_en = NOW() WHERE id = ${f.id}`;

      if (emailHabilitado()) {
        const cuerpoCli = `<p style="margin:0 0 14px">Hola ${escEmail(cli?.nombre || '')},</p>
          <p style="margin:0 0 16px">Tu ficha <b>${escEmail(f.titulo)}</b> queda <b>firmada y validada por ambas partes</b>. Con esto damos por aprobado el alcance del agente. Seguimos con la implementación.</p>
          ${tarjetaDatos([['Ficha', escEmail(f.titulo)], ['Nº de validación', escEmail(f.firma_ref || '')]])}
          <p style="margin:16px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
        if (cli?.email) { try { await enviarEmail({ to: cli.email, subject: `Ficha validada — seguimos · Conecta NEX`, html: envolverEmail({ titulo: 'Ficha validada', preheader: 'Firmada por ambas partes; seguimos con la implementación.', cuerpoHtml: cuerpoCli }), replyTo: process.env.REPLY_TO_EMAIL }); } catch { /* noop */ } }
        const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
        const destino = process.env.AGENCY_EMAIL || em?.email;
        if (destino) { try { await enviarEmail({ to: destino, subject: `✅ Ficha VALIDADA — ${escEmail(cli?.nombre || '')}`, html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="color:#0c7b6d">Ficha validada por la agencia</h2><p>${escEmail(f.titulo)} · cliente ${escEmail(cli?.nombre || '')}</p><p><a href="${BASE}/clientes/${f.cliente_id}">Ficha del cliente</a></p></div>` }); } catch { /* noop */ } }
      }
      return jsonResponse(res, 200, { ok: true, estado: 'validada' });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('validar-ficha error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}
