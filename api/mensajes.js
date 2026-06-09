// Bandeja de entrada (respuestas recibidas) - gestion desde el panel (con login).
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { traerContenidoResend } from './_resend.js';

// Completa el cuerpo de los mensajes que llegaron sin texto/html (el webhook
// solo trae metadatos; aqui ya ha pasado tiempo y Resend tiene el cuerpo listo).
async function completarCuerpos() {
  const pend = await sql`
    SELECT id, email_id FROM mensajes_recibidos
    WHERE email_id IS NOT NULL AND email_id != ''
      AND coalesce(texto,'') = '' AND coalesce(html,'') = ''
    ORDER BY recibido_en DESC LIMIT 10`;
  for (const m of pend) {
    const full = await traerContenidoResend(m.email_id, 0);
    if (full && (full.text || full.html)) {
      await sql`UPDATE mensajes_recibidos SET texto = ${full.text || ''}, html = ${full.html || ''} WHERE id = ${m.id}`;
    }
  }
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });
  try {
    if (req.method === 'GET') {
      try { await completarCuerpos(); } catch { /* no bloquea la bandeja */ }
      const rows = await sql`
        SELECT m.*, p.empresa AS prospecto_empresa, c.nombre AS cliente_nombre
        FROM mensajes_recibidos m
        LEFT JOIN prospectos p ON p.id = m.prospecto_id
        LEFT JOIN clientes c ON c.id = m.cliente_id
        ORDER BY m.recibido_en DESC LIMIT 500`;
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM mensajes_recibidos WHERE leido = FALSE`;
      return jsonResponse(res, 200, { mensajes: rows, no_leidos: n });
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`UPDATE mensajes_recibidos SET leido = ${b.leido !== false} WHERE id = ${b.id} RETURNING *`;
      return jsonResponse(res, 200, row);
    }
    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM mensajes_recibidos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
