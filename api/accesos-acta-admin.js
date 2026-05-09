import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { descifrar } from './_crypto.js';

// Endpoint con AUTH para que Lazaro vea, desbloquee o desactive accesos al acta.
export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });

      const conPin = req.query.con_pin === '1';
      const filas = await sql`
        SELECT id, cliente_id, documento_id, token, codigo_aceptacion, pin_cifrado,
               intentos_fallidos, bloqueado_hasta, visitas, ultimo_acceso,
               email_enviado, fecha_envio_email, activo, creado_en
        FROM accesos_acta
        WHERE cliente_id = ${clienteId}
        ORDER BY creado_en DESC
      `;
      const out = filas.map(r => ({
        id: r.id,
        cliente_id: r.cliente_id,
        documento_id: r.documento_id,
        token: r.token,
        codigo_aceptacion: r.codigo_aceptacion,
        pin: conPin ? descifrar(r.pin_cifrado) : null,
        intentos_fallidos: r.intentos_fallidos,
        bloqueado_hasta: r.bloqueado_hasta,
        visitas: r.visitas,
        ultimo_acceso: r.ultimo_acceso,
        email_enviado: r.email_enviado,
        fecha_envio_email: r.fecha_envio_email,
        activo: r.activo,
        creado_en: r.creado_en,
      }));
      return jsonResponse(res, 200, out);
    }

    if (req.method === 'PUT') {
      // Acciones: desbloquear, desactivar
      const { id, accion } = req.body || {};
      if (!id || !accion) return jsonResponse(res, 400, { error: 'Faltan id o accion' });

      if (accion === 'desbloquear') {
        await sql`
          UPDATE accesos_acta SET
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            actualizado_en = NOW()
          WHERE id = ${id}
        `;
        return jsonResponse(res, 200, { ok: true });
      }

      if (accion === 'desactivar') {
        await sql`UPDATE accesos_acta SET activo = FALSE, actualizado_en = NOW() WHERE id = ${id}`;
        return jsonResponse(res, 200, { ok: true });
      }

      if (accion === 'activar') {
        await sql`UPDATE accesos_acta SET activo = TRUE, actualizado_en = NOW() WHERE id = ${id}`;
        return jsonResponse(res, 200, { ok: true });
      }

      return jsonResponse(res, 400, { error: 'Accion no valida' });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM accesos_acta WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
