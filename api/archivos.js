import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      const id = req.query.id ? parseInt(req.query.id, 10) : null;
      const formato = req.query.formato || 'binario'; // 'binario' o 'dataurl'

      if (id) {
        const [row] = await sql`SELECT id, cliente_id, nombre, tipo, tamano, contenido, incluir_en_acta, creado_en FROM archivos WHERE id = ${id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });

        // Modo dataurl: devuelve JSON con { id, nombre, tipo, dataurl: "data:...;base64,..." }
        // Util para embeber en HTML del PDF sin problemas de CORS.
        if (formato === 'dataurl') {
          const buf = Buffer.from(row.contenido);
          const base64 = buf.toString('base64');
          return jsonResponse(res, 200, {
            id: row.id,
            nombre: row.nombre,
            tipo: row.tipo,
            tamano: row.tamano,
            dataurl: `data:${row.tipo};base64,${base64}`,
          });
        }

        // Modo binario (descarga directa)
        const buf = Buffer.from(row.contenido);
        res.setHeader('Content-Type', row.tipo);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.nombre)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.send(buf);
      }

      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const rows = await sql`SELECT id, cliente_id, nombre, tipo, tamano, incluir_en_acta, creado_en FROM archivos WHERE cliente_id = ${clienteId} ORDER BY creado_en DESC`;
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
        RETURNING id, cliente_id, nombre, tipo, tamano, incluir_en_acta, creado_en
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      // Actualiza solo metadatos (no el binario): nombre, incluir_en_acta
      const { id, nombre, incluir_en_acta } = req.body || {};
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });

      const [actual] = await sql`SELECT id, nombre, incluir_en_acta FROM archivos WHERE id = ${id}`;
      if (!actual) return jsonResponse(res, 404, { error: 'No encontrado' });

      const nuevoNombre = nombre !== undefined ? nombre : actual.nombre;
      const nuevoFlag = incluir_en_acta !== undefined ? !!incluir_en_acta : actual.incluir_en_acta;

      const [row] = await sql`
        UPDATE archivos
        SET nombre = ${nuevoNombre}, incluir_en_acta = ${nuevoFlag}
        WHERE id = ${id}
        RETURNING id, cliente_id, nombre, tipo, tamano, incluir_en_acta, creado_en
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
