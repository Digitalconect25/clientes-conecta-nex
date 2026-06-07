// Citas vistas y gestionadas por la AGENCIA (requiere login).
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

const ESTADOS = ['pendiente', 'confirmada', 'hecha', 'cancelada'];

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT c.*, p.empresa AS prospecto_empresa
        FROM citas c LEFT JOIN prospectos p ON p.id = c.prospecto_id
        ORDER BY c.fecha ASC, c.hora ASC`;
      return jsonResponse(res, 200, rows);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.fecha || !b.hora) return jsonResponse(res, 400, { error: 'Falta fecha u hora' });
      const [row] = await sql`
        INSERT INTO citas (nombre, email, telefono, fecha, hora, nota, estado, origen)
        VALUES (${b.nombre || ''}, ${b.email || ''}, ${b.telefono || ''}, ${b.fecha}, ${b.hora},
                ${b.nota || ''}, ${ESTADOS.includes(b.estado) ? b.estado : 'confirmada'}, ${'manual'})
        RETURNING *`;
      return jsonResponse(res, 200, row);
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE citas SET estado = ${ESTADOS.includes(b.estado) ? b.estado : 'pendiente'}, nota = ${b.nota || ''}
        WHERE id = ${b.id} RETURNING *`;
      return jsonResponse(res, 200, row);
    }
    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM citas WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
