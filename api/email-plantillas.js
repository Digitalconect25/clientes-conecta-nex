import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM email_plantillas WHERE id = ${req.query.id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrada' });
        return jsonResponse(res, 200, row);
      }
      const rows = await sql`
        SELECT * FROM email_plantillas
        WHERE activa = TRUE
        ORDER BY orden ASC, nombre ASC
      `;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const p = req.body || {};
      if (!p.nombre || !p.asunto || !p.cuerpo_html) {
        return jsonResponse(res, 400, { error: 'nombre, asunto y cuerpo_html obligatorios' });
      }
      const [row] = await sql`
        INSERT INTO email_plantillas (nombre, descripcion, asunto, cuerpo_html, categoria, activa, orden)
        VALUES (
          ${p.nombre}, ${p.descripcion || ''}, ${p.asunto}, ${p.cuerpo_html},
          ${p.categoria || 'General'}, ${p.activa !== false}, ${p.orden || 0}
        ) RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const p = req.body || {};
      if (!p.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE email_plantillas SET
          nombre = ${p.nombre},
          descripcion = ${p.descripcion || ''},
          asunto = ${p.asunto},
          cuerpo_html = ${p.cuerpo_html},
          categoria = ${p.categoria || 'General'},
          activa = ${p.activa !== false},
          orden = ${p.orden || 0},
          actualizado_en = NOW()
        WHERE id = ${p.id}
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM email_plantillas WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
