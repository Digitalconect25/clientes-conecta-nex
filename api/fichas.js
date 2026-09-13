// Admin (protegido con X-App-Password): crear "Fichas de implementacion" para
// un cliente, elegir que secciones necesita, generar su enlace privado y
// enviarlo por email. El cliente la rellena y firma desde /api/ficha (publico,
// por token) — ver ese archivo para el flujo de cumplimentacion y firma.
//   GET    /api/fichas                    -> lista (resumen, todos los clientes)
//   GET    /api/fichas?cliente_id=        -> lista de un cliente
//   GET    /api/fichas?id=                -> detalle completo (con contenido)
//   POST   /api/fichas                    -> crear { cliente_id, titulo?, secciones[] }
//   POST   /api/fichas  accion=enviar_enlace { id, email?, nombre_destinatario? }
//   PUT    /api/fichas                    -> actualizar { id, titulo?, secciones? }
//   DELETE /api/fichas?id=                -> borrar (solo si no esta firmada)
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';
import { SECCIONES_FICHA } from '../src/lib/fichas.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const CLAVES_VALIDAS = new Set(SECCIONES_FICHA.map((s) => s.clave));

let _mig = false;
export async function asegurarFichas() {
  if (_mig) return;
  await sql`CREATE TABLE IF NOT EXISTS fichas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL DEFAULT 'Ficha de implementacion del agente IA WhatsApp',
    version INTEGER NOT NULL DEFAULT 1,
    secciones JSONB NOT NULL DEFAULT '[]',
    contenido JSONB NOT NULL DEFAULT '{}',
    estado TEXT NOT NULL DEFAULT 'borrador',
    token TEXT UNIQUE,
    destinatario_email TEXT DEFAULT '',
    destinatario_nombre TEXT DEFAULT '',
    enviada_en TIMESTAMPTZ,
    vista_en TIMESTAMPTZ,
    completada_en TIMESTAMPTZ,
    contenido_html TEXT,
    firmante_nombre TEXT,
    firmante_nif TEXT,
    firmante_cargo TEXT,
    firmante_email TEXT,
    firma_codigo TEXT,
    firma_codigo_exp TIMESTAMPTZ,
    firma_img TEXT,
    firma_hash TEXT,
    firma_ref TEXT,
    firmante_ip TEXT,
    firmante_user_agent TEXT,
    fecha_firma TIMESTAMPTZ,
    validacion_token TEXT,
    validacion_codigo TEXT,
    validacion_codigo_exp TIMESTAMPTZ,
    validado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fichas_cliente ON fichas(cliente_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fichas_token ON fichas(token)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fichas_validacion_token ON fichas(validacion_token)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fichas_estado ON fichas(estado)`;
  _mig = true;
}

const RESUMEN = sql => sql`
  SELECT f.id, f.cliente_id, f.titulo, f.version, f.secciones, f.estado, f.token,
    f.destinatario_email, f.destinatario_nombre, f.enviada_en, f.vista_en, f.completada_en,
    f.firmante_nombre, f.fecha_firma, f.firma_ref, f.validado_en, f.creado_en, f.actualizado_en,
    c.nombre AS cliente_nombre, c.email AS cliente_email
  FROM fichas f JOIN clientes c ON c.id = f.cliente_id`;

function seccionesValidas(arr) {
  return (Array.isArray(arr) ? arr : []).filter((c) => CLAVES_VALIDAS.has(c));
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    await asegurarFichas();

    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT f.*, c.nombre AS cliente_nombre, c.email AS cliente_email, c.nif AS cliente_nif
          FROM fichas f JOIN clientes c ON c.id = f.cliente_id WHERE f.id = ${parseInt(req.query.id, 10)}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrada' });
        return jsonResponse(res, 200, row);
      }
      if (req.query.cliente_id) {
        const rows = await RESUMEN(sql)`WHERE f.cliente_id = ${parseInt(req.query.cliente_id, 10)} ORDER BY f.creado_en DESC`;
        return jsonResponse(res, 200, rows);
      }
      const rows = await RESUMEN(sql)`ORDER BY f.creado_en DESC LIMIT 300`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const b = req.body || {};

      if (b.accion === 'enviar_enlace') {
        const id = parseInt(b.id, 10);
        if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
        const [ficha] = await sql`SELECT * FROM fichas WHERE id = ${id}`;
        if (!ficha) return jsonResponse(res, 404, { error: 'Ficha no encontrada' });
        if (['firmada', 'validada'].includes(ficha.estado)) return jsonResponse(res, 409, { error: 'Esta ficha ya está firmada; no se puede reenviar para editar.' });
        const [cliente] = await sql`SELECT nombre, email FROM clientes WHERE id = ${ficha.cliente_id}`;
        const email = String(b.email || ficha.destinatario_email || cliente?.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return jsonResponse(res, 400, { error: 'Falta un email válido del destinatario.' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado en el servidor.' });
        const tok = ficha.token || crypto.randomBytes(24).toString('base64url');
        const nombreDest = String(b.nombre_destinatario || ficha.destinatario_nombre || cliente?.nombre || '').trim();
        const url = `${BASE}/ficha/${tok}`;
        const cuerpo = `
          <p style="margin:0 0 14px">Hola ${escEmail(nombreDest || cliente?.nombre || '')},</p>
          <p style="margin:0 0 16px">Te enviamos la <b>ficha de implementación del agente de IA para WhatsApp</b>. Rellénala con calma desde el ordenador o el móvil — puedes guardarla como borrador y volver más tarde — y al final la firmas para darnos el visto bueno.</p>
          ${tarjetaDatos([['Ficha', escEmail(ficha.titulo)]])}
          ${botonEmail(url, 'Completar la ficha')}
          <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">El enlace es privado y personal, no lo compartas. Si tienes dudas, responde a este correo.</p>
          <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
        await enviarEmail({
          to: email,
          subject: `Ficha de implementación del agente IA · Conecta NEX`,
          html: envolverEmail({ titulo: 'Tu ficha de implementación', preheader: 'Complétala cuando puedas, se guarda sola como borrador.', cuerpoHtml: cuerpo }),
          replyTo: process.env.REPLY_TO_EMAIL,
        });
        const [row] = await sql`UPDATE fichas SET
            token = ${tok}, destinatario_email = ${email}, destinatario_nombre = ${nombreDest},
            estado = CASE WHEN estado = 'borrador' THEN 'enviada' ELSE estado END,
            enviada_en = COALESCE(enviada_en, NOW()), actualizado_en = NOW()
          WHERE id = ${id} RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      const { cliente_id, titulo, secciones } = b;
      const clienteId = parseInt(cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta el cliente.' });
      const secc = seccionesValidas(secciones);
      if (!secc.length) return jsonResponse(res, 400, { error: 'Elige al menos un apartado.' });
      const [row] = await sql`
        INSERT INTO fichas (cliente_id, titulo, secciones)
        VALUES (${clienteId}, ${String(titulo || 'Ficha de implementación del agente IA WhatsApp').trim()}, ${JSON.stringify(secc)}::jsonb)
        RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const { id, titulo, secciones } = req.body || {};
      const fid = parseInt(id, 10);
      if (!fid) return jsonResponse(res, 400, { error: 'Falta id' });
      const [ficha] = await sql`SELECT estado FROM fichas WHERE id = ${fid}`;
      if (!ficha) return jsonResponse(res, 404, { error: 'No encontrada' });
      if (['firmada', 'validada'].includes(ficha.estado)) return jsonResponse(res, 409, { error: 'Esta ficha ya está firmada; no se puede modificar.' });
      const secc = secciones !== undefined ? seccionesValidas(secciones) : null;
      const [row] = await sql`UPDATE fichas SET
          titulo = COALESCE(${titulo ? String(titulo).trim() : null}, titulo),
          secciones = COALESCE(${secc ? JSON.stringify(secc) : null}::jsonb, secciones),
          actualizado_en = NOW()
        WHERE id = ${fid} RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [ficha] = await sql`SELECT estado FROM fichas WHERE id = ${id}`;
      if (!ficha) return jsonResponse(res, 200, { ok: true });
      if (['firmada', 'validada'].includes(ficha.estado)) return jsonResponse(res, 409, { error: 'No se puede borrar una ficha ya firmada (queda como evidencia).' });
      await sql`DELETE FROM fichas WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('fichas admin error:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
