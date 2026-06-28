import crypto from 'node:crypto';
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

let _mig = false;
async function asegurar() {
  if (_mig) return;
  try { await sql`ALTER TABLE emisor ADD COLUMN IF NOT EXISTS firma_emisor TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE emisor ADD COLUMN IF NOT EXISTS firma_token TEXT`; } catch { /* noop */ }
  _mig = true;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  // Generar enlace de captura de firma (movil) tambien con CRON_SECRET.
  const cronOk = req.method === 'POST' && !!process.env.CRON_SECRET && req.body?.secret === process.env.CRON_SECRET;
  if (!auth.ok && !cronOk) return jsonResponse(res, 401, { error: auth.error });

  try {
    await asegurar();

    if (req.method === 'POST' && req.body?.accion === 'firma_link') {
      const tok = crypto.randomBytes(20).toString('base64url');
      await sql`UPDATE emisor SET firma_token = ${tok} WHERE id = 1`;
      return jsonResponse(res, 200, { ok: true, url: `${BASE}/firma-empresa/${tok}` });
    }

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
          logo_url = ${e.logo_url || ''},
          firma_emisor = ${e.firma_emisor || ''}
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
