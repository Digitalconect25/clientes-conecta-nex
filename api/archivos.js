import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      const id = req.query.id ? parseInt(req.query.id, 10) : null;

      if (id) {
        const [row] = await sql`SELECT id, cliente_id, nombre, tipo, tamano, contenido, creado_en FROM archivos WHERE id = ${id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });
        const buf = Buffer.from(row.contenido);
        res.setHeader('Content-Type', row.tipo);
        res.setHeader('Content-Disposition', `attachment; filename="${row.nombre}"`);
        return res.send(buf);
      }

      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const rows = await sql`SELECT id, cliente_id, nombre, tipo, tamano, creado_en FROM archivos WHERE cliente_id = ${clienteId} ORDER BY creado_en DESC`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const { cliente_id, nombre, tipo, contenido_base64 } = req.body || {};
      if (!cliente_id || !nombre || !contenido_base64) {
        return jsonResponse(res, 400, { error: 'Faltan campos' });
      }
      const buffer = Buffer.from(contenido_base64, 'base64');
      const [row] = await sql`
        INSERT INTO archivos (cliente_id, nombre, tipo, tamano, contenido)
        VALUES (${cliente_id}, ${nombre}, ${tipo || 'application/octet-stream'}, ${buffer.length}, ${buffer})
        RETURNING id, cliente_id, nombre, tipo, tamano, creado_en
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM archivos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
