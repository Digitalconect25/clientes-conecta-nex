// Vercel Cron (1x/dia, manana): recordatorios de cita + preparacion de reuniones.
//   - A cada lead con cita CONFIRMADA hoy o manana: email recordatorio (+ .ics).
//   - A la agencia: un resumen con el DOSSIER de las citas de hoy y un boton
//     wa.me de 1 clic para recordar por WhatsApp a los que dejaron telefono.
// Seguridad: Authorization: Bearer CRON_SECRET (o ?secret=).
import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { crearIcs, icsAdjunto } from './_ics.js';
import { waLink } from './_whatsapp.js';
import { generarDossier } from './dossier.js';
import { modalidadTextoLead, modalidadParaIcs, modalidadLabel } from './_modalidad.js';

export const maxDuration = 60;

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOWS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fechaLarga(f) {
  try { const d = new Date(String(f).slice(0, 10) + 'T12:00:00'); return `${DOWS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; }
  catch { return String(f); }
}
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function asegurarColumna() {
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS recordatorio_en timestamptz`; } catch { /* noop */ }
}

// Recordatorio al lead por email (con .ics). Marca recordatorio_en para no repetir el mismo dia.
async function recordarLead(c, cuandoTxt) {
  if (!c.email || !RE_EMAIL.test(c.email) || !emailHabilitado()) return false;
  const ubic = modalidadParaIcs(c.modalidad, c.enlace_reunion);
  const ics = crearIcs({ id: c.id, fecha: c.fecha, hora: c.hora, durMin: 30, titulo: 'Cita con Conecta NEX', ubicacion: ubic.ubicacion, url: ubic.url });
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#2b2b2b">
    <div style="text-align:center;padding:12px 0"><img src="${BASE}/logo-email.png" alt="Conecta NEX" width="140" style="max-width:140px;height:auto"></div>
    <div style="border:1px solid #eee;border-radius:12px;padding:22px">
      <p>Hola ${esc(c.nombre || '')},</p>
      <p>Te recordamos tu cita con <b>Conecta NEX</b>:</p>
      <p style="font-size:17px;font-weight:bold;margin:10px 0">${cuandoTxt}</p>
      <p style="color:#444">${esc(modalidadTextoLead(c.modalidad, c.enlace_reunion))} Si necesitas cambiarla, responde a este correo y la ajustamos.</p>
      <p style="margin-top:16px">Un saludo,<br><b>Equipo Conecta NEX</b><br><span style="color:#888;font-size:13px">Calle Alberola 24, Alicante · conectanex.es</span></p>
    </div></div>`;
  try {
    await enviarEmail({ to: c.email, subject: `Recordatorio de tu cita — ${cuandoTxt} · Conecta NEX`, html, attachments: [icsAdjunto(ics)], replyTo: process.env.REPLY_TO_EMAIL });
    await sql`UPDATE citas SET recordatorio_en = NOW() WHERE id = ${c.id}`;
    return true;
  } catch (e) { console.error('recordarLead:', e.message); return false; }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const ok = !!secret && (authHeader === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return jsonResponse(res, 401, { error: 'no auth' });

  try {
    await asegurarColumna();
    const hoy = ymd(new Date());
    const manana = ymd(new Date(Date.now() + 24 * 3600 * 1000));

    const citasHoy = await sql`
      SELECT c.id, c.nombre, c.email, c.telefono, to_char(c.fecha,'YYYY-MM-DD') AS fecha, c.hora, c.estado,
             COALESCE(c.dossier,'') AS dossier, COALESCE(c.modalidad,'a_concretar') AS modalidad,
             COALESCE(c.enlace_reunion,'') AS enlace_reunion, c.recordatorio_en, p.empresa AS empresa
      FROM citas c LEFT JOIN prospectos p ON p.id = c.prospecto_id
      WHERE to_char(c.fecha,'YYYY-MM-DD') = ${hoy} AND c.estado IN ('confirmada','pendiente')
      ORDER BY c.hora ASC`;
    const citasManana = await sql`
      SELECT c.id, c.nombre, c.email, c.telefono, to_char(c.fecha,'YYYY-MM-DD') AS fecha, c.hora, c.estado,
             COALESCE(c.modalidad,'a_concretar') AS modalidad, COALESCE(c.enlace_reunion,'') AS enlace_reunion, c.recordatorio_en
      FROM citas c WHERE to_char(c.fecha,'YYYY-MM-DD') = ${manana} AND c.estado = 'confirmada'
      ORDER BY c.hora ASC`;

    let recordados = 0, dossiers = 0;

    // 1) Recordatorio a leads con cita MANANA (confirmada), si no se les recordo hoy ya.
    for (const c of citasManana) {
      const yaHoy = c.recordatorio_en && String(c.recordatorio_en).slice(0, 10) === hoy;
      if (yaHoy) continue;
      if (await recordarLead(c, `mañana ${fechaLarga(c.fecha)} a las ${c.hora} h`)) recordados++;
    }
    // 2) Recordatorio a leads con cita HOY confirmada (si no se les recordo hoy) + asegurar dossier.
    for (const c of citasHoy) {
      if (!c.dossier) { try { c.dossier = await generarDossier(c.id); dossiers++; } catch { /* sin red */ } }
      const yaHoy = c.recordatorio_en && String(c.recordatorio_en).slice(0, 10) === hoy;
      if (c.estado === 'confirmada' && !yaHoy) {
        if (await recordarLead(c, `hoy ${fechaLarga(c.fecha)} a las ${c.hora} h`)) recordados++;
      }
    }

    // 3) Resumen a la agencia con dossier + boton wa.me por cita (recordatorio WhatsApp 1 clic).
    const [em] = await sql`SELECT email FROM emisor WHERE id = 1`;
    const destino = process.env.AGENCY_EMAIL || em?.email;
    if (destino && emailHabilitado() && citasHoy.length) {
      const bloques = citasHoy.map((c) => {
        const cuando = `${c.hora} h`;
        const waTxt = `Hola ${c.nombre || ''}, te recordamos tu cita con Conecta NEX hoy a las ${c.hora} h. ${modalidadTextoLead(c.modalidad, c.enlace_reunion)} Si necesitas cambiarla, dinos. Un saludo.`;
        const wa = c.telefono ? waLink(c.telefono, waTxt) : '';
        return `<div style="border:1px solid #e6e1d8;border-radius:10px;padding:14px;margin:0 0 12px">
          <div style="font-weight:700;font-size:15px">${cuando} · ${esc(c.nombre || c.empresa || 'Sin nombre')} <span style="color:#5b3fa0;font-size:12px;font-weight:600">· ${esc(modalidadLabel(c.modalidad))}</span> ${c.estado === 'pendiente' ? '<span style="color:#b8860b;font-size:12px">(sin confirmar)</span>' : ''}</div>
          <div style="color:#667;font-size:13px;margin:2px 0 8px">${esc(c.email || '')}${c.telefono ? ' · ' + esc(c.telefono) : ''}</div>
          ${wa ? `<a href="${wa}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:9px 16px;border-radius:8px;font-size:14px">Recordar por WhatsApp</a>` : '<span style="color:#999;font-size:12px">Sin teléfono para WhatsApp</span>'}
          ${c.dossier ? `<div style="margin-top:10px;background:#faf9f6;border:1px solid #eee;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:13px;line-height:1.5">${esc(c.dossier)}</div>` : ''}
        </div>`;
      }).join('');
      try {
        await enviarEmail({
          to: destino,
          subject: `Hoy tienes ${citasHoy.length} cita(s) — preparación + recordatorios`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#222">
            <h2 style="margin:0 0 4px">Tus citas de hoy</h2>
            <p style="color:#667;margin:0 0 16px">Pulsa "Recordar por WhatsApp" para enviar el recordatorio con un toque. Abajo tienes la base para presentar de cada negocio.</p>
            ${bloques}
            <p style="color:#999;font-size:12px;margin-top:8px">Conecta NEX · panel: <a href="${BASE}/agenda">Agenda</a></p>
          </div>`,
        });
      } catch (e) { console.error('digest agencia:', e.message); }
    }

    return jsonResponse(res, 200, { ok: true, hoy, manana, citas_hoy: citasHoy.length, citas_manana: citasManana.length, recordados, dossiers });
  } catch (err) {
    console.error('cron-citas error:', err);
    return jsonResponse(res, 200, { ok: false, error: err.message });
  }
}
