// Endpoint PUBLICO del formulario de solicitud (sin login de agencia).
//   GET  /api/solicitud           -> { categorias: [{categoria, servicios:[...]}] }
//   POST /api/solicitud  { nombre, empresa, email, telefono, sector, mensaje, servicios:[ids], origen }
//        -> crea un prospecto (origen 'formulario') con los servicios pedidos.
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, nombre, categoria, descripcion FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
      const map = new Map();
      for (const s of rows) {
        if (!map.has(s.categoria)) map.set(s.categoria, []);
        map.get(s.categoria).push({ id: s.id, nombre: s.nombre, descripcion: s.descripcion || '' });
      }
      const categorias = [...map.entries()].map(([categoria, servicios]) => ({ categoria, servicios }));
      return jsonResponse(res, 200, { categorias });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const nombre = String(b.nombre || '').trim();
      const email = String(b.email || '').trim();
      const telefono = String(b.telefono || '').trim();
      if (!nombre) return jsonResponse(res, 400, { error: 'Falta tu nombre.' });
      if (email && !RE_EMAIL.test(email)) return jsonResponse(res, 400, { error: 'Email no valido.' });
      if (!email && !telefono) return jsonResponse(res, 400, { error: 'Deja un email o un telefono para poder contactarte.' });

      // Resolver los servicios elegidos (por id) a nombre/categoria reales.
      const ids = (Array.isArray(b.servicios) ? b.servicios : []).map((x) => parseInt(x, 10)).filter(Boolean);
      let serviciosSel = [];
      if (ids.length) {
        serviciosSel = await sql`SELECT id, nombre, categoria FROM servicios WHERE id = ANY(${ids})`;
      }
      const listaTxt = serviciosSel.map((s) => s.nombre).join(', ');
      const obs = `Solicitud desde formulario${b.origen === 'anuncio' ? ' (anuncio)' : ''}.` +
        (listaTxt ? ` Servicios: ${listaTxt}.` : '') + (b.mensaje ? ` Mensaje: ${String(b.mensaje).trim()}` : '');

      const [row] = await sql`
        INSERT INTO prospectos (empresa, nombre, email, telefono, sector, website, situacion, observaciones, estado, origen, servicios_json)
        VALUES (${String(b.empresa || '').trim()}, ${nombre}, ${email}, ${telefono}, ${String(b.sector || '').trim()},
                ${''}, ${'mejorable'}, ${obs}, ${'respondido'}, ${b.origen === 'anuncio' ? 'anuncio' : 'formulario'},
                ${JSON.stringify(serviciosSel)}::jsonb)
        RETURNING id`;

      // Aviso a la agencia (si el email esta configurado)
      if (emailHabilitado() && process.env.AGENCY_EMAIL) {
        try {
          await enviarEmail({
            to: process.env.AGENCY_EMAIL,
            subject: `Nueva solicitud: ${b.empresa || nombre}`,
            html: `<div style="font-family:sans-serif"><h2>Nueva solicitud desde el formulario</h2>
              <p><b>${nombre}</b>${b.empresa ? ' - ' + b.empresa : ''}<br>${email || ''} ${telefono || ''}</p>
              <p>Sector: ${b.sector || '-'}</p>
              <p>Servicios pedidos: ${listaTxt || '-'}</p>
              <p>Mensaje: ${b.mensaje || '-'}</p></div>`,
          });
        } catch { /* no bloquea */ }
      }
      return jsonResponse(res, 200, { ok: true, id: row.id });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
