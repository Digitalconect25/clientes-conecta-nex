import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const rows = await sql`SELECT id, cliente_id, tipo, nombre, firmado, fecha_firma, creado_en FROM documentos WHERE cliente_id = ${clienteId} ORDER BY creado_en DESC`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const { cliente_id, tipo, nombre, contenido_html } = req.body || {};
      if (!cliente_id || !tipo || !nombre) return jsonResponse(res, 400, { error: 'Faltan campos' });
      const [row] = await sql`
        INSERT INTO documentos (cliente_id, tipo, nombre, contenido_html)
        VALUES (${cliente_id}, ${tipo}, ${nombre}, ${contenido_html || ''})
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
          firmado = ${firmado === true ? true : false},
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
