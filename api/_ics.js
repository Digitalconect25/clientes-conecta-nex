// Genera un evento de calendario (.ics / iCalendar) para una cita.
// Se usa hora LOCAL flotante (sin Z): el cliente de correo la muestra tal cual
// (hora de Espana), evitando lios de zona horaria/horario de verano.

function pad(n) { return String(n).padStart(2, '0'); }

// 'YYYY-MM-DD' + 'HH:MM' (+ minutos) -> 'YYYYMMDDTHHMMSS' (hora flotante local).
function aStamp(fecha, hora, addMin = 0) {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  let [hh, mm] = String(hora).slice(0, 5).split(':').map(Number);
  let total = hh * 60 + mm + addMin;
  const dd = d + Math.floor(total / (24 * 60));
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  hh = Math.floor(total / 60); mm = total % 60;
  return `${y}${pad(m)}${pad(dd)}T${pad(hh)}${pad(mm)}00`;
}

// Sello UTC para DTSTAMP/UID (se pasa una fecha base ya calculada por el caller).
function stampUTC(fechaIso) {
  const s = String(fechaIso || '');
  // admite un timestamp ISO; si no, cae a la propia fecha de inicio sin Z.
  return s.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z');
}

function escIcs(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function crearIcs({ id, fecha, hora, durMin = 30, titulo, descripcion, ubicacion, organizadorEmail, organizadorNombre, ahoraIso }) {
  const dtStart = aStamp(fecha, hora, 0);
  const dtEnd = aStamp(fecha, hora, durMin);
  const uid = `cita-${id || dtStart}@conectanex.com`;
  const dtstamp = ahoraIso ? stampUTC(ahoraIso) : `${dtStart}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Conecta NEX//Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escIcs(titulo || 'Cita con Conecta NEX')}`,
    descripcion ? `DESCRIPTION:${escIcs(descripcion)}` : '',
    ubicacion ? `LOCATION:${escIcs(ubicacion)}` : '',
    organizadorEmail ? `ORGANIZER;CN=${escIcs(organizadorNombre || 'Conecta NEX')}:mailto:${organizadorEmail}` : '',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escIcs(titulo || 'Cita con Conecta NEX')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

// Adjunto inline para Resend (base64). content_type con metodo PUBLISH.
export function icsAdjunto(ics, filename = 'cita-conectanex.ics') {
  return {
    filename,
    content: Buffer.from(ics, 'utf-8').toString('base64'),
    content_type: 'text/calendar; method=PUBLISH; charset=UTF-8',
  };
}
