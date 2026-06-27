// Modalidad de la cita. Por defecto SIEMPRE empezamos por LLAMADA telefónica;
// cuando el proyecto está más claro se pasa a Zoom o visita presencial.
export const MODALIDADES = {
  telefono: { label: 'Llamada telefónica' },
  zoom: { label: 'Videollamada (Zoom)' },
  presencial: { label: 'Visita presencial' },
};
export const MODALIDAD_DEFECTO = 'telefono';

export function modalidadLabel(m) {
  return (MODALIDADES[m] || MODALIDADES.telefono).label;
}

// Frase orientada al cliente para el email.
export function modalidadTextoLead(m, enlace) {
  switch (m) {
    case 'zoom': return enlace
      ? `La haremos por videollamada (Zoom). Enlace para conectarte: ${enlace}`
      : 'La haremos por videollamada (Zoom). Te enviaremos el enlace antes de la cita.';
    case 'presencial': return 'Será una visita presencial. Te confirmamos el lugar.';
    case 'telefono':
    default: return 'Es una llamada telefónica: te llamamos a la hora que elijas, sin compromiso.';
  }
}

// Datos para el evento .ics (ubicacion + url opcional).
export function modalidadParaIcs(m, enlace) {
  switch (m) {
    case 'zoom': return { ubicacion: enlace ? `Videollamada Zoom: ${enlace}` : 'Videollamada (Zoom)', url: enlace || '' };
    case 'presencial': return { ubicacion: 'Calle Alberola 24, 03007 Alicante', url: '' };
    case 'telefono':
    default: return { ubicacion: 'Llamada telefónica', url: '' };
  }
}
