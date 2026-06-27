// Citas vistas y gestionadas por la AGENCIA (requiere login).
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

const ESTADOS = ['pendiente', 'confirmada', 'hecha', 'cancelada'];
const MODALIDADES = ['telefono', 'zoom', 'presencial'];
const HORAS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Auto-migración: asegura la columna de notas internas (idempotente, una vez por instancia).
let _migrado = false;
async function asegurarColumnas() {
  if (_migrado) return;
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS nota_interna text DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS dossier text DEFAULT ''`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS dossier_en timestamptz`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS modalidad text DEFAULT 'telefono'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ALTER COLUMN modalidad SET DEFAULT 'telefono'`; } catch { /* noop */ }
  try { await sql`UPDATE citas SET modalidad = 'telefono' WHERE modalidad IS NULL OR modalidad = 'a_concretar'`; } catch { /* noop */ }
  try { await sql`ALTER TABLE citas ADD COLUMN IF NOT EXISTS enlace_reunion text DEFAULT ''`; } catch { /* noop */ }
  _migrado = true;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });
  try {
    await asegurarColumnas();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT c.id, c.prospecto_id, c.cliente_id, c.nombre, c.email, c.telefono,
               to_char(c.fecha, 'YYYY-MM-DD') AS fecha, c.hora, c.nota,
               COALESCE(c.nota_interna,'') AS nota_interna, c.estado, c.origen,
               COALESCE(c.dossier,'') AS dossier,
               COALESCE(c.modalidad,'telefono') AS modalidad, COALESCE(c.enlace_reunion,'') AS enlace_reunion,
               to_char(c.dossier_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS dossier_en,
               to_char(c.creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS creado_en,
               p.empresa AS prospecto_empresa, p.website AS prospecto_web, p.sector AS prospecto_sector
        FROM citas c LEFT JOIN prospectos p ON p.id = c.prospecto_id
        ORDER BY c.fecha ASC, c.hora ASC`;
      return jsonResponse(res, 200, rows);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.fecha || !b.hora) return jsonResponse(res, 400, { error: 'Falta fecha u hora' });
      const [row] = await sql`
        INSERT INTO citas (nombre, email, telefono, fecha, hora, nota, estado, origen, modalidad, enlace_reunion)
        VALUES (${b.nombre || ''}, ${b.email || ''}, ${b.telefono || ''}, ${b.fecha}, ${b.hora},
                ${b.nota || ''}, ${ESTADOS.includes(b.estado) ? b.estado : 'confirmada'}, ${'manual'},
                ${MODALIDADES.includes(b.modalidad) ? b.modalidad : 'telefono'}, ${String(b.enlace_reunion || '').trim()})
        RETURNING *`;
      return jsonResponse(res, 200, row);
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });

      // Reprogramar: si llega fecha/hora, validar y comprobar que el hueco esté libre.
      if (b.fecha || b.hora) {
        if (!RE_FECHA.test(String(b.fecha || '')) || !HORAS.includes(String(b.hora || ''))) {
          return jsonResponse(res, 400, { error: 'Día u hora no válidos para reprogramar.' });
        }
        const ocupado = await sql`
          SELECT 1 FROM citas
          WHERE fecha = ${b.fecha} AND hora = ${b.hora} AND estado != 'cancelada' AND id <> ${b.id}
          LIMIT 1`;
        if (ocupado.length) return jsonResponse(res, 409, { error: 'Esa hora ya está ocupada, elige otra.' });
      }

      const estado = ESTADOS.includes(b.estado) ? b.estado : null;
      const modalidad = MODALIDADES.includes(b.modalidad) ? b.modalidad : null;
      const [row] = await sql`
        UPDATE citas SET
          estado        = COALESCE(${estado}, estado),
          nota          = COALESCE(${b.nota ?? null}, nota),
          nota_interna  = COALESCE(${b.nota_interna ?? null}, nota_interna),
          modalidad     = COALESCE(${modalidad}, modalidad),
          enlace_reunion = COALESCE(${b.enlace_reunion ?? null}, enlace_reunion),
          fecha         = COALESCE(${b.fecha || null}::date, fecha),
          hora          = COALESCE(${b.hora || null}, hora)
        WHERE id = ${b.id}
        RETURNING id, to_char(fecha,'YYYY-MM-DD') AS fecha, hora, estado, nota, COALESCE(nota_interna,'') AS nota_interna,
                  COALESCE(modalidad,'telefono') AS modalidad, COALESCE(enlace_reunion,'') AS enlace_reunion`;
      return jsonResponse(res, 200, row);
    }
    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM citas WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
