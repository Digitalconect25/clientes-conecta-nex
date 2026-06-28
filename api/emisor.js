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

    // Corregir campos puntuales del emisor (solo los enviados; el resto se mantiene).
    if (req.method === 'POST' && req.body?.accion === 'set_campos') {
      const c = req.body.campos || {};
      const norm = (v) => (v == null ? null : String(v));
      const up = (v) => (v == null ? null : String(v).toUpperCase());
      const [row] = await sql`
        UPDATE emisor SET
          nombre = COALESCE(${norm(c.nombre)}, nombre),
          nif = COALESCE(${up(c.nif)}, nif),
          nombre_comercial = COALESCE(${norm(c.nombre_comercial)}, nombre_comercial),
          epigrafe = COALESCE(${norm(c.epigrafe)}, epigrafe),
          direccion = COALESCE(${norm(c.direccion)}, direccion),
          cp = COALESCE(${norm(c.cp)}, cp),
          ciudad = COALESCE(${norm(c.ciudad)}, ciudad),
          provincia = COALESCE(${norm(c.provincia)}, provincia),
          email = COALESCE(${norm(c.email)}, email),
          telefono = COALESCE(${norm(c.telefono)}, telefono),
          web = COALESCE(${norm(c.web)}, web),
          iban = COALESCE(${up(c.iban)}, iban)
        WHERE id = 1
        RETURNING id, nombre, nif, nombre_comercial, email, iban`;
      return jsonResponse(res, 200, { ok: true, emisor: row });
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
