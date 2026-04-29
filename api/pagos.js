import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (clienteId) {
        const rows = await sql`SELECT * FROM pagos WHERE cliente_id = ${clienteId} ORDER BY fecha_esperada ASC NULLS LAST, creado_en DESC`;
        return jsonResponse(res, 200, rows);
      }
      // Sin cliente_id devuelve todos (para dashboard)
      const rows = await sql`SELECT p.*, c.nombre AS cliente_nombre, c.numero_cliente FROM pagos p JOIN clientes c ON c.id = p.cliente_id ORDER BY p.fecha_esperada ASC NULLS LAST, p.creado_en DESC`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const p = req.body || {};
      if (!p.cliente_id || !p.concepto || p.importe == null) {
        return jsonResponse(res, 400, { error: 'cliente_id, concepto e importe obligatorios' });
      }
      const [row] = await sql`
        INSERT INTO pagos (
          cliente_id, concepto, importe, fecha_esperada, fecha_pago,
          metodo, estado, es_recurrente, mes_recurrencia, notas
        ) VALUES (
          ${p.cliente_id}, ${p.concepto}, ${p.importe},
          ${p.fecha_esperada || null}, ${p.fecha_pago || null},
          ${p.metodo || 'Transferencia'}, ${p.estado || 'Pendiente'},
          ${p.es_recurrente || false}, ${p.mes_recurrencia || null},
          ${p.notas || ''}
        ) RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const p = req.body || {};
      if (!p.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE pagos SET
          concepto = ${p.concepto},
          importe = ${p.importe},
          fecha_esperada = ${p.fecha_esperada || null},
          fecha_pago = ${p.fecha_pago || null},
          metodo = ${p.metodo || 'Transferencia'},
          estado = ${p.estado || 'Pendiente'},
          es_recurrente = ${p.es_recurrente || false},
          mes_recurrencia = ${p.mes_recurrencia || null},
          notas = ${p.notas || ''},
          actualizado_en = NOW()
        WHERE id = ${p.id}
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM pagos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
