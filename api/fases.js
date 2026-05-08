import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

// Recalcula el porcentaje_avance del cliente segun las fases completadas.
async function recalcularAvanceCliente(clienteId) {
  const fases = await sql`SELECT estado, peso FROM fases WHERE cliente_id = ${clienteId}`;
  if (fases.length === 0) {
    await sql`UPDATE clientes SET porcentaje_avance = 0 WHERE id = ${clienteId}`;
    return 0;
  }
  const totalPesos = fases.reduce((s, f) => s + Number(f.peso), 0) || 1;
  const completados = fases
    .filter((f) => f.estado === 'Completada')
    .reduce((s, f) => s + Number(f.peso), 0);
  const pct = Math.round((completados / totalPesos) * 100);
  await sql`UPDATE clientes SET porcentaje_avance = ${pct}, actualizado_en = NOW() WHERE id = ${clienteId}`;
  return pct;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (clienteId) {
        const rows = await sql`SELECT * FROM fases WHERE cliente_id = ${clienteId} ORDER BY orden ASC, id ASC`;
        return jsonResponse(res, 200, rows);
      }
      // Sin cliente_id devuelve todas las fases con datos del cliente (para vista kanban)
      const rows = await sql`
        SELECT f.*, c.nombre AS cliente_nombre, c.numero_cliente, c.estado AS cliente_estado, c.estado_proyecto
        FROM fases f
        JOIN clientes c ON c.id = f.cliente_id
        ORDER BY f.cliente_id, f.orden ASC
      `;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const f = req.body || {};
      if (!f.cliente_id || !f.nombre) {
        return jsonResponse(res, 400, { error: 'cliente_id y nombre obligatorios' });
      }
      const [row] = await sql`
        INSERT INTO fases (cliente_id, orden, nombre, estado, peso, fecha_prevista_inicio, fecha_prevista_fin, fecha_real_inicio, fecha_real_fin, notas)
        VALUES (
          ${f.cliente_id}, ${f.orden || 0}, ${f.nombre}, ${f.estado || 'Pendiente'}, ${f.peso || 10},
          ${f.fecha_prevista_inicio || null}, ${f.fecha_prevista_fin || null},
          ${f.fecha_real_inicio || null}, ${f.fecha_real_fin || null}, ${f.notas || ''}
        ) RETURNING *
      `;
      await recalcularAvanceCliente(f.cliente_id);
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const f = req.body || {};
      if (!f.id) return jsonResponse(res, 400, { error: 'Falta id' });

      // Si pasa de Pendiente a En curso y no tiene fecha_real_inicio, la ponemos hoy
      let fechaInicio = f.fecha_real_inicio || null;
      let fechaFin = f.fecha_real_fin || null;
      if (f.estado === 'En curso' && !fechaInicio) fechaInicio = new Date().toISOString().split('T')[0];
      if (f.estado === 'Completada' && !fechaFin) fechaFin = new Date().toISOString().split('T')[0];
      if (f.estado === 'Completada' && !fechaInicio) fechaInicio = new Date().toISOString().split('T')[0];

      const [row] = await sql`
        UPDATE fases SET
          orden = ${f.orden != null ? f.orden : 0},
          nombre = ${f.nombre},
          estado = ${f.estado || 'Pendiente'},
          peso = ${f.peso || 10},
          fecha_prevista_inicio = ${f.fecha_prevista_inicio || null},
          fecha_prevista_fin = ${f.fecha_prevista_fin || null},
          fecha_real_inicio = ${fechaInicio},
          fecha_real_fin = ${fechaFin},
          notas = ${f.notas || ''},
          actualizado_en = NOW()
        WHERE id = ${f.id}
        RETURNING *
      `;
      if (row) await recalcularAvanceCliente(row.cliente_id);
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`SELECT cliente_id FROM fases WHERE id = ${id}`;
      await sql`DELETE FROM fases WHERE id = ${id}`;
      if (row) await recalcularAvanceCliente(row.cliente_id);
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
