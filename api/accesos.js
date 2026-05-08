import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { cifrar, descifrar } from './_crypto.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const clienteId = parseInt(req.query.cliente_id, 10);
      if (!clienteId) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
      const conPassword = req.query.con_password === '1';

      const rows = await sql`
        SELECT id, cliente_id, categoria, etiqueta, url, usuario, password_cifrado, notas, importante, creado_en
        FROM accesos
        WHERE cliente_id = ${clienteId}
        ORDER BY importante DESC, categoria ASC, etiqueta ASC
      `;

      const out = rows.map((r) => {
        const tienePassword = !!r.password_cifrado;
        const obj = {
          id: r.id,
          cliente_id: r.cliente_id,
          categoria: r.categoria,
          etiqueta: r.etiqueta,
          url: r.url,
          usuario: r.usuario,
          tiene_password: tienePassword,
          notas: r.notas,
          importante: r.importante,
          creado_en: r.creado_en,
        };
        if (conPassword) {
          obj.password = tienePassword ? descifrar(r.password_cifrado) : '';
        }
        return obj;
      });
      return jsonResponse(res, 200, out);
    }

    if (req.method === 'POST') {
      const a = req.body || {};
      if (!a.cliente_id || !a.etiqueta) {
        return jsonResponse(res, 400, { error: 'cliente_id y etiqueta obligatorios' });
      }
      const passwordCifrado = a.password ? cifrar(a.password) : '';
      const [row] = await sql`
        INSERT INTO accesos (cliente_id, categoria, etiqueta, url, usuario, password_cifrado, notas, importante)
        VALUES (
          ${a.cliente_id}, ${a.categoria || 'Otros'}, ${a.etiqueta},
          ${a.url || ''}, ${a.usuario || ''}, ${passwordCifrado},
          ${a.notas || ''}, ${a.importante === true}
        ) RETURNING id, cliente_id, categoria, etiqueta, url, usuario, notas, importante, creado_en
      `;
      return jsonResponse(res, 200, { ...row, tiene_password: !!passwordCifrado });
    }

    if (req.method === 'PUT') {
      const a = req.body || {};
      if (!a.id) return jsonResponse(res, 400, { error: 'Falta id' });

      // Si pasa password, lo recifra. Si manda string vacio explicito, vacia el campo.
      // Si no manda la propiedad password, deja el actual.
      let passwordSql;
      if (Object.prototype.hasOwnProperty.call(a, 'password')) {
        passwordSql = a.password ? cifrar(a.password) : '';
      } else {
        const [actual] = await sql`SELECT password_cifrado FROM accesos WHERE id = ${a.id}`;
        passwordSql = actual ? actual.password_cifrado : '';
      }

      const [row] = await sql`
        UPDATE accesos SET
          categoria = ${a.categoria || 'Otros'},
          etiqueta = ${a.etiqueta},
          url = ${a.url || ''},
          usuario = ${a.usuario || ''},
          password_cifrado = ${passwordSql},
          notas = ${a.notas || ''},
          importante = ${a.importante === true},
          actualizado_en = NOW()
        WHERE id = ${a.id}
        RETURNING id, cliente_id, categoria, etiqueta, url, usuario, notas, importante, creado_en
      `;
      return jsonResponse(res, 200, { ...row, tiene_password: !!passwordSql });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM accesos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
