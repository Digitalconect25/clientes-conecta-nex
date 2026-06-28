import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

export const config = {
  api: { bodyParser: { sizeLimit: '12mb' } },
};

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

let _mig = false;
export async function asegurarColumnas() {
  if (_mig) return;
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_token TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_estado TEXT DEFAULT 'borrador'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_email TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_nombre TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_ip TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firmante_user_agent TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_hash TEXT DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_enviada_en TIMESTAMPTZ`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_vista_en TIMESTAMPTZ`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_codigo TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_codigo_exp TIMESTAMPTZ`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_img TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS firma_ref TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_identidad BOOLEAN DEFAULT FALSE`; } catch { /* noop */ }
  _mig = true;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    await asegurarColumnas();

    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM documentos WHERE id = ${parseInt(req.query.id, 10)}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });
        return jsonResponse(res, 200, row);
      }
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const rows = await sql`SELECT id, cliente_id, tipo, nombre, firmado, fecha_firma, creado_en,
          COALESCE(firma_estado,'borrador') AS firma_estado, firma_token,
          COALESCE(firmante_nombre,'') AS firmante_nombre, COALESCE(firmante_ip,'') AS firmante_ip, firma_enviada_en
        FROM documentos WHERE cliente_id = ${clienteId} ORDER BY creado_en DESC`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const b = req.body || {};

      // Enviar el documento al CLIENTE para que lo firme él mismo (firma remota).
      if (b.accion === 'enviar_firma') {
        const id = parseInt(b.id, 10);
        if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!emailHabilitado()) return jsonResponse(res, 400, { error: 'Email no configurado.' });
        const [doc] = await sql`SELECT * FROM documentos WHERE id = ${id}`;
        if (!doc) return jsonResponse(res, 404, { error: 'Documento no encontrado' });
        if (doc.firmado) return jsonResponse(res, 409, { error: 'Este documento ya está firmado.' });
        const [cliente] = await sql`SELECT nombre, email FROM clientes WHERE id = ${doc.cliente_id}`;
        const email = String(b.email || cliente?.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return jsonResponse(res, 400, { error: 'Falta un email válido del cliente.' });
        const tok = doc.firma_token || crypto.randomBytes(24).toString('base64url');
        const url = `${BASE}/firmar/${tok}`;
        const cuerpo = `
          <p style="margin:0 0 14px">Hola ${escEmail(cliente?.nombre || '')},</p>
          <p style="margin:0 0 16px">Te enviamos tu <b>${escEmail(doc.nombre)}</b> para que lo revises y, si estás de acuerdo, lo firmes online. Es rápido y seguro.</p>
          ${tarjetaDatos([['Documento', escEmail(doc.nombre)]])}
          ${botonEmail(url, 'Ver y firmar el documento')}
          <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">Al firmar quedará registrada la fecha y hora. Si tienes dudas, responde a este correo.</p>
          <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
        await enviarEmail({
          to: email,
          subject: `Firma tu ${doc.nombre} · Conecta NEX`,
          html: envolverEmail({ titulo: 'Documento para firmar', preheader: `${doc.nombre} — listo para tu firma`, cuerpoHtml: cuerpo }),
          replyTo: process.env.REPLY_TO_EMAIL,
        });
        const [row] = await sql`UPDATE documentos SET
            firma_token = ${tok}, firmante_email = ${email},
            firma_estado = CASE WHEN firmado THEN firma_estado ELSE 'enviado' END,
            firma_enviada_en = NOW()
          WHERE id = ${id}
          RETURNING id, cliente_id, tipo, nombre, firmado, fecha_firma, creado_en, firma_estado, firma_token, firmante_email`;
        return jsonResponse(res, 200, row);
      }

      const { cliente_id, tipo, nombre, contenido_html, firmado } = b;
      if (!cliente_id || !tipo || !nombre) return jsonResponse(res, 400, { error: 'Faltan campos' });
      const [row] = await sql`
        INSERT INTO documentos (cliente_id, tipo, nombre, contenido_html, firmado, fecha_firma)
        VALUES (${cliente_id}, ${tipo}, ${nombre}, ${contenido_html || ''}, ${firmado === true}, ${firmado === true ? new Date().toISOString() : null})
        RETURNING id, cliente_id, tipo, nombre, firmado, fecha_firma, creado_en
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const { id, contenido_html, firmado } = req.body || {};
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE documentos SET
          contenido_html = COALESCE(${contenido_html}, contenido_html),
          firmado = ${firmado === true},
          fecha_firma = ${firmado === true ? new Date().toISOString() : null}
        WHERE id = ${id}
        RETURNING id, cliente_id, tipo, nombre, firmado, fecha_firma, creado_en
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM documentos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
