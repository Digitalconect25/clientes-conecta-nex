import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const { nombre, categoria, precio, descripcion } = req.body || {};
      if (!nombre || !categoria) return jsonResponse(res, 400, { error: 'Faltan campos' });
      const [row] = await sql`
        INSERT INTO servicios (nombre, categoria, precio, descripcion)
        VALUES (${nombre}, ${categoria}, ${precio || 0}, ${descripcion || ''})
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const { id, nombre, categoria, precio, descripcion } = req.body || {};
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE servicios SET
          nombre = ${nombre},
          categoria = ${categoria},
          precio = ${precio || 0},
          descripcion = ${descripcion || ''}
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`UPDATE servicios SET activo = FALSE WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
