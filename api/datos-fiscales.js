// Endpoint PUBLICO: el cliente completa sus DATOS FISCALES desde un enlace (token).
//   GET  /api/datos-fiscales?token=...   -> datos actuales para precargar el form
//   POST /api/datos-fiscales?token=...   -> guarda los datos en su ficha
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';

let _mig = false;
async function asegurar() {
  if (_mig) return;
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_token TEXT`; } catch { /* noop */ }
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_estado TEXT DEFAULT 'pendiente'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_completados_en TIMESTAMPTZ`; } catch { /* noop */ }
  _mig = true;
}

function publico(c) {
  return {
    estado: c.datos_estado || 'enviado',
    tipo_persona: c.tipo_persona || 'Fisica',
    nombre: c.nombre || '', nif: c.nif || '', contacto: c.contacto || '',
    direccion: c.direccion || '', cp: c.cp || '', ciudad: c.ciudad || '', provincia: c.provincia || '', pais: c.pais || 'España',
    email: c.email || '', telefono: c.telefono || '',
  };
}

export default async function handler(req, res) {
  try {
    await asegurar();
    const tok = String(req.query.token || (req.body && req.body.token) || '').trim();
    if (!tok) return jsonResponse(res, 400, { error: 'Falta token' });
    const [c] = await sql`SELECT * FROM clientes WHERE datos_token = ${tok}`;
    if (!c) return jsonResponse(res, 404, { error: 'Enlace no válido o caducado.' });

    if (req.method === 'GET') return jsonResponse(res, 200, publico(c));

    if (req.method === 'POST') {
      if (!(await limitar(obtenerIp(req), 'datosfiscales', 10, 60))) return jsonResponse(res, 429, { error: 'Demasiadas peticiones. Espera un momento.' });
      const b = req.body || {};
      const nombre = String(b.nombre || '').trim();
      const nif = String(b.nif || '').trim().toUpperCase();
      const tipo = b.tipo_persona === 'Juridica' ? 'Juridica' : 'Fisica';
      if (!nombre) return jsonResponse(res, 400, { error: tipo === 'Juridica' ? 'Falta la razón social.' : 'Falta tu nombre completo.' });
      if (!nif) return jsonResponse(res, 400, { error: tipo === 'Juridica' ? 'Falta el CIF.' : 'Falta el NIF/DNI.' });
      if (b.email && !RE_EMAIL.test(String(b.email))) return jsonResponse(res, 400, { error: 'Email no válido.' });

      await sql`UPDATE clientes SET
          tipo_persona = ${tipo}, nombre = ${nombre}, nif = ${nif}, contacto = ${String(b.contacto || '').trim()},
          direccion = ${String(b.direccion || '').trim()}, cp = ${String(b.cp || '').trim()},
          ciudad = ${String(b.ciudad || '').trim()}, provincia = ${String(b.provincia || '').trim() || 'Alicante'},
          pais = ${String(b.pais || '').trim() || 'España'},
          email = ${String(b.email || '').trim()}, telefono = ${String(b.telefono || '').trim()},
          datos_estado = 'completado', datos_completados_en = NOW(), actualizado_en = NOW()
        WHERE id = ${c.id}`;

      // Aviso a la agencia
      try {
        const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
        const destino = process.env.AGENCY_EMAIL || em?.email;
        if (destino && emailHabilitado()) {
          await enviarEmail({
            to: destino,
            subject: `Datos fiscales completados — ${nombre}`,
            html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="color:#0c7b6d">Datos fiscales recibidos</h2><p><b>${nombre}</b> · ${tipo === 'Juridica' ? 'CIF' : 'NIF'} ${nif}</p><p>${b.direccion || ''} ${b.cp || ''} ${b.ciudad || ''} ${b.provincia || ''}</p><p>Ya puedes generar y enviar el contrato. <a href="${BASE}/clientes/${c.id}">Ficha del cliente</a></p></div>`,
          });
        }
      } catch { /* no bloquea */ }

      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('datos-fiscales error:', err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar. Inténtalo de nuevo.' });
  }
}
