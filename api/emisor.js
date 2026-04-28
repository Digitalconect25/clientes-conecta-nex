import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const [row] = await sql`SELECT * FROM emisor WHERE id = 1`;
      return jsonResponse(res, 200, row || {});
    }

    if (req.method === 'PUT') {
      const e = req.body || {};
      const [row] = await sql`
        UPDATE emisor SET
          nombre = ${e.nombre || ''},
          nif = ${(e.nif || '').toUpperCase()},
          nombre_comercial = ${e.nombre_comercial || ''},
          epigrafe = ${e.epigrafe || ''},
          direccion = ${e.direccion || ''},
          cp = ${e.cp || ''},
          ciudad = ${e.ciudad || ''},
          provincia = ${e.provincia || ''},
          email = ${e.email || ''},
          telefono = ${e.telefono || ''},
          web = ${e.web || ''},
          iban = ${(e.iban || '').toUpperCase()},
          logo_url = ${e.logo_url || ''}
        WHERE id = 1
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
