// Endpoint PUBLICO de reserva de citas (sin login de agencia).
// Lo usa el prospecto/cliente desde el boton "Agendar cita" del email,
// el formulario de la web y el Agente Nex.
//   GET  /api/agendar?fecha=YYYY-MM-DD  -> { slots: [...], motivo? }
//   POST /api/agendar  { p, fecha, hora, nombre, email, telefono, nota } -> { ok }
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { obtenerIp, limitar } from './_publico.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, tarjetaDatos, escEmail } from './_emailLayout.js';

// Horario de atencion (EDITA AQUI). diasLaborables: 1=lunes ... 5=viernes
const DIAS_LABORABLES = [1, 2, 3, 4, 5];
const HORAS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOWS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Firma del enlace de confirmacion (sin guardar token en BD).
export function firmaCita(id) {
  const secret = process.env.ACCESS_ENCRYPTION_KEY || process.env.APP_PASSWORD || 'cn-fallback-secret';
  return crypto.createHmac('sha256', secret).update('cita:' + id).digest('hex').slice(0, 24);
}

// Asegura las columnas que usa la reserva (la migracion principal vive en el
// panel /api/citas, con login; aqui garantizamos que existan en el flujo publico).
let _migCitas = false;
async function asegurarCitas() {
  if (_migCitas) return;
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS modalidad text DEFAULT 'telefono'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS enlace_reunion text DEFAULT ''`; } catch { /* noop */ }
  _migCitas = true;
}

function fechaLarga(fecha) {
  try {
    const d = new Date(fecha + 'T12:00:00');
    return `${DOWS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return fecha; }
}

function emailConfirmacionHTML({ nombre, fecha, hora, nota, urlConfirmar }) {
  const cuando = `${fechaLarga(fecha)} a las ${hora} h`;
  const saludo = nombre ? `Hola ${escEmail(nombre)},` : 'Hola,';
  const cuerpo = `
    <p style="margin:0 0 14px">${saludo}</p>
    <p style="margin:0 0 16px">Hemos recibido tu solicitud de cita. Revísala y <b>confírmala</b> para dejarla reservada en firme.</p>
    ${tarjetaDatos([['Fecha y hora', escEmail(cuando)], nota ? ['Tu nota', escEmail(nota)] : null])}
    ${botonEmail(urlConfirmar, 'Aceptar y confirmar la cita')}
    <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">Si no reconoces esta solicitud, ignora este correo: no se reservará nada.</p>
    <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
  return envolverEmail({ titulo: 'Confirma tu cita', preheader: 'Pulsa para dejar tu cita reservada en firme.', cuerpoHtml: cuerpo });
}

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
      const nombre = String(b.nombre).trim();
      const email = String(b.email || '').trim();
      const nota = String(b.nota || '').trim();
      await asegurarCitas();
      let nuevaId = null;
      try {
        const [row] = await sql`
          INSERT INTO citas (prospecto_id, nombre, email, telefono, fecha, hora, nota, estado, origen, modalidad)
          VALUES (${pid}, ${nombre}, ${email}, ${String(b.telefono || '').trim()},
                  ${fecha}, ${hora}, ${nota}, ${'pendiente'}, ${'frio'}, ${'telefono'})
          RETURNING id`;
        nuevaId = row?.id;
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
      // Email de confirmacion con boton "Aceptar y confirmar" (doble opt-in).
      if (nuevaId && email && emailHabilitado()) {
        try {
          const urlConfirmar = `${BASE}/api/confirmar-cita?c=${nuevaId}&s=${firmaCita(nuevaId)}`;
          await enviarEmail({
            to: email,
            subject: `Confirma tu cita con Conecta NEX — ${fecha} ${hora} h`,
            html: emailConfirmacionHTML({ nombre, fecha, hora, nota, urlConfirmar }),
          });
        } catch (e) { console.error('Email cita no enviado:', e.message); }
      }
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: 'No se pudo procesar la reserva. Intentalo de nuevo.' });
  }
}
