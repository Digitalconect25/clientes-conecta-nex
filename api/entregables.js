import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

// Recalcula el porcentaje_avance del cliente sumando avance de fases y entregables.
// Si el cliente tiene fases, esas pesan el 70% del avance, y los entregables el 30%.
// Si solo tiene entregables, esos pesan el 100%.
// Si solo tiene fases, esas pesan el 100%.
async function recalcularAvanceCliente(clienteId) {
  const fases = await sql`SELECT estado, peso FROM fases WHERE cliente_id = ${clienteId}`;
  const entregables = await sql`SELECT completado FROM entregables WHERE cliente_id = ${clienteId}`;

  const tieneFases = fases.length > 0;
  const tieneEntregables = entregables.length > 0;

  let pct = 0;
  if (tieneFases && tieneEntregables) {
    const totalPesos = fases.reduce((s, f) => s + Number(f.peso), 0) || 1;
    const completadosPeso = fases.filter(f => f.estado === 'Completada').reduce((s, f) => s + Number(f.peso), 0);
    const pctFases = (completadosPeso / totalPesos) * 100;

    const completadosEnt = entregables.filter(e => e.completado).length;
    const pctEnt = (completadosEnt / entregables.length) * 100;

    pct = Math.round(pctFases * 0.7 + pctEnt * 0.3);
  } else if (tieneFases) {
    const totalPesos = fases.reduce((s, f) => s + Number(f.peso), 0) || 1;
    const completadosPeso = fases.filter(f => f.estado === 'Completada').reduce((s, f) => s + Number(f.peso), 0);
    pct = Math.round((completadosPeso / totalPesos) * 100);
  } else if (tieneEntregables) {
    const completadosEnt = entregables.filter(e => e.completado).length;
    pct = Math.round((completadosEnt / entregables.length) * 100);
  }

  await sql`UPDATE clientes SET porcentaje_avance = ${pct}, actualizado_en = NOW() WHERE id = ${clienteId}`;
  return pct;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const rows = await sql`
        SELECT * FROM entregables
        WHERE cliente_id = ${clienteId}
        ORDER BY orden ASC, id ASC
      `;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const e = req.body || {};
      if (!e.cliente_id || !e.nombre) {
        return jsonResponse(res, 400, { error: 'cliente_id y nombre obligatorios' });
      }
      const [row] = await sql`
        INSERT INTO entregables (cliente_id, nombre, categoria, completado, fecha_completado, orden, notas)
        VALUES (
          ${e.cliente_id}, ${e.nombre}, ${e.categoria || 'General'},
          ${e.completado === true},
          ${e.completado === true ? new Date().toISOString() : null},
          ${e.orden || 0}, ${e.notas || ''}
        ) RETURNING *
      `;
      await recalcularAvanceCliente(e.cliente_id);
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const e = req.body || {};
      if (!e.id) return jsonResponse(res, 400, { error: 'Falta id' });

      // Si se marca como completado y no tenia fecha, ponerla ahora
      let fechaCompletado = e.fecha_completado || null;
      if (e.completado === true && !fechaCompletado) {
        fechaCompletado = new Date().toISOString();
      }
      // Si se desmarca, quitar la fecha
      if (e.completado === false) fechaCompletado = null;

      const [row] = await sql`
        UPDATE entregables SET
          nombre = ${e.nombre},
          categoria = ${e.categoria || 'General'},
          completado = ${e.completado === true},
          fecha_completado = ${fechaCompletado},
          orden = ${e.orden != null ? e.orden : 0},
          notas = ${e.notas || ''},
          actualizado_en = NOW()
        WHERE id = ${e.id}
        RETURNING *
      `;
      if (row) await recalcularAvanceCliente(row.cliente_id);
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`SELECT cliente_id FROM entregables WHERE id = ${id}`;
      await sql`DELETE FROM entregables WHERE id = ${id}`;
      if (row) await recalcularAvanceCliente(row.cliente_id);
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
