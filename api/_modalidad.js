// Modalidad de la cita: telefono | zoom | presencial | a_concretar.
// Mientras este "a_concretar" (por defecto) los textos NO afirman el medio.
export const MODALIDADES = {
  a_concretar: { label: 'A concretar' },
  telefono: { label: 'Llamada telefónica' },
  zoom: { label: 'Videollamada (Zoom)' },
  presencial: { label: 'Presencial' },
};

export function modalidadLabel(m) {
  return (MODALIDADES[m] || MODALIDADES.a_concretar).label;
}

// Frase orientada al cliente para el email.
export function modalidadTextoLead(m, enlace) {
  switch (m) {
    case 'telefono': return 'Es una llamada telefónica: te llamamos a la hora que elijas, sin compromiso.';
    case 'zoom': return enlace
      ? `La haremos por videollamada (Zoom). Enlace para conectarte: ${enlace}`
      : 'La haremos por videollamada (Zoom). Te enviaremos el enlace antes de la cita.';
    case 'presencial': return 'Será una reunión presencial. Te confirmamos el lugar.';
    default: return 'Te confirmaremos el formato (teléfono o videollamada por Zoom) antes de la cita.';
  }
}

// Datos para el evento .ics (ubicacion + url opcional).
export function modalidadParaIcs(m, enlace) {
  switch (m) {
    case 'telefono': return { ubicacion: 'Llamada telefónica', url: '' };
    case 'zoom': return { ubicacion: enlace ? `Videollamada Zoom: ${enlace}` : 'Videollamada (Zoom)', url: enlace || '' };
    case 'presencial': return { ubicacion: 'Calle Alberola 24, 03007 Alicante', url: '' };
    default: return { ubicacion: 'A concretar (teléfono o Zoom)', url: '' };
  }
}
