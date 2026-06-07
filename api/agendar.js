// Endpoint PUBLICO de reserva de citas (sin login de agencia).
// Lo usa el prospecto/cliente desde el boton "Agendar cita" del email.
//   GET  /api/agendar?fecha=YYYY-MM-DD  -> { slots: [...], motivo? }
//   POST /api/agendar  { p, fecha, hora, nombre, email, telefono, nota } -> { ok }
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';

// Horario de atencion (EDITA AQUI). diasLaborables: 1=lunes ... 5=viernes
const DIAS_LABORABLES = [1, 2, 3, 4, 5];
const HORAS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function slotsLibres(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  const dow = d.getDay(); // 0=domingo
  if (!DIAS_LABORABLES.includes(dow)) return { slots: [], motivo: 'no_laborable' };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (d < hoy) return { slots: [], motivo: 'pasado' };
  const ocupadas = await sql`SELECT hora FROM citas WHERE fecha = ${fecha} AND estado != 'cancelada'`;
  const taken = new Set(ocupadas.map((r) => r.hora));
  return { slots: HORAS.filter((h) => !taken.has(h)) };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const fecha = String(req.query.fecha || '');
      if (!RE_FECHA.test(fecha)) return jsonResponse(res, 200, { slots: [] });
      return jsonResponse(res, 200, await slotsLibres(fecha));
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      // Honeypot: si un bot rellena el campo oculto, fingimos exito y no guardamos.
      if (b.website2) return jsonResponse(res, 200, { ok: true });
      if (!(await limitar(obtenerIp(req), 'agendar', 8, 60))) return jsonResponse(res, 429, { error: 'Demasiadas solicitudes. Intentalo en un momento.' });
      const fecha = String(b.fecha || ''), hora = String(b.hora || '');
      if (!RE_FECHA.test(fecha) || !HORAS.includes(hora)) return jsonResponse(res, 400, { error: 'Dia u hora no validos.' });
      if (!String(b.nombre || '').trim()) return jsonResponse(res, 400, { error: 'Falta tu nombre.' });
      if (b.email && !RE_EMAIL.test(String(b.email))) return jsonResponse(res, 400, { error: 'Email no valido.' });
      // Comprobar que la franja sigue libre
      const { slots } = await slotsLibres(fecha);
      if (!slots.includes(hora)) return jsonResponse(res, 409, { error: 'Esa hora ya no esta disponible, elige otra.' });
      const pid = parseInt(b.p, 10) || null;
      try {
        await sql`
          INSERT INTO citas (prospecto_id, nombre, email, telefono, fecha, hora, nota, estado, origen)
          VALUES (${pid}, ${String(b.nombre).trim()}, ${String(b.email || '').trim()}, ${String(b.telefono || '').trim()},
                  ${fecha}, ${hora}, ${String(b.nota || '').trim()}, ${'pendiente'}, ${'frio'})`;
      } catch (e) {
        // Indice unico uq_citas_franja: dos reservas simultaneas a la misma hora.
        if (String(e.message || '').includes('uq_citas_franja') || e.code === '23505')
          return jsonResponse(res, 409, { error: 'Esa hora se acaba de ocupar, elige otra.' });
        throw e;
      }
      // Si viene de un prospecto, marcarlo como que respondio (mostro interes).
      if (pid) {
        try { await sql`UPDATE prospectos SET estado = 'respondido', actualizado_en = NOW() WHERE id = ${pid} AND estado IN ('nuevo','email_enviado')`; } catch { /* opcional */ }
      }
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar la reserva. Intentalo de nuevo.' });
  }
}
