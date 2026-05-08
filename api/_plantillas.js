// Plantillas de fases segun el servicio contratado.
// Cuando se aplica una plantilla, se crean filas en la tabla "fases".
// Si el cliente tiene varios servicios, se combinan las fases sin duplicar.

export const PLANTILLAS = {
  'Webs y landings': [
    { nombre: 'Briefing y materiales', peso: 10 },
    { nombre: 'Wireframes y arquitectura', peso: 15 },
    { nombre: 'Diseno visual', peso: 20 },
    { nombre: 'Aprobacion del cliente', peso: 5 },
    { nombre: 'Desarrollo', peso: 30 },
    { nombre: 'Revision y ajustes', peso: 10 },
    { nombre: 'Entrega y formacion', peso: 10 },
  ],
  'Identidad': [
    { nombre: 'Briefing de marca', peso: 15 },
    { nombre: 'Concepto y propuestas', peso: 25 },
    { nombre: 'Aprobacion del cliente', peso: 10 },
    { nombre: 'Aplicaciones y manual', peso: 40 },
    { nombre: 'Entrega de archivos', peso: 10 },
  ],
  'Bots': [
    { nombre: 'Briefing y casos de uso', peso: 15 },
    { nombre: 'Configuracion de cuenta y API', peso: 20 },
    { nombre: 'Construccion de flujos', peso: 35 },
    { nombre: 'Pruebas con cliente', peso: 15 },
    { nombre: 'Lanzamiento y formacion', peso: 15 },
  ],
  'Mensual': [
    { nombre: 'Onboarding inicial', peso: 20 },
    { nombre: 'Mes en curso', peso: 60 },
    { nombre: 'Reporte mensual', peso: 20 },
  ],
  'Diseno Canva': [
    { nombre: 'Briefing visual', peso: 20 },
    { nombre: 'Diseno de piezas', peso: 50 },
    { nombre: 'Revision y ajustes', peso: 15 },
    { nombre: 'Entrega de archivos', peso: 15 },
  ],
  'Codigos QR': [
    { nombre: 'Definicion de destino', peso: 25 },
    { nombre: 'Generacion y prueba', peso: 50 },
    { nombre: 'Entrega de archivos', peso: 25 },
  ],
  'Redes y Google': [
    { nombre: 'Auditoria inicial', peso: 25 },
    { nombre: 'Optimizacion', peso: 50 },
    { nombre: 'Entrega y formacion', peso: 25 },
  ],
  'Combos': [
    { nombre: 'Briefing y materiales', peso: 10 },
    { nombre: 'Identidad y diseno', peso: 25 },
    { nombre: 'Desarrollo', peso: 35 },
    { nombre: 'Aprobacion del cliente', peso: 10 },
    { nombre: 'Entrega y formacion', peso: 20 },
  ],
  'Otros': [
    { nombre: 'Definicion del trabajo', peso: 20 },
    { nombre: 'Ejecucion', peso: 60 },
    { nombre: 'Entrega', peso: 20 },
  ],
  'Personalizado': [
    { nombre: 'Briefing inicial', peso: 20 },
    { nombre: 'Trabajo principal', peso: 50 },
    { nombre: 'Revision', peso: 15 },
    { nombre: 'Entrega', peso: 15 },
  ],
};

// Fallback generico si la categoria no encaja con ninguna plantilla
export const PLANTILLA_GENERICA = [
  { nombre: 'Briefing', peso: 20 },
  { nombre: 'Trabajo principal', peso: 50 },
  { nombre: 'Revision', peso: 15 },
  { nombre: 'Entrega', peso: 15 },
];

// Dada una lista de servicios contratados (con su categoria), construye una
// lista de fases combinada, sin duplicar nombres y manteniendo orden razonable.
export function construirFasesDesdeCategorias(categorias) {
  const fasesAcumuladas = [];
  const nombresVistos = new Set();
  const cats = categorias && categorias.length > 0 ? categorias : ['Otros'];
  cats.forEach((cat) => {
    const plantilla = PLANTILLAS[cat] || PLANTILLA_GENERICA;
    plantilla.forEach((f) => {
      if (!nombresVistos.has(f.nombre)) {
        nombresVistos.add(f.nombre);
        fasesAcumuladas.push({ ...f });
      }
    });
  });
  // Renormalizar pesos para que sumen 100
  const sumaPesos = fasesAcumuladas.reduce((s, f) => s + f.peso, 0) || 1;
  return fasesAcumuladas.map((f, i) => ({
    orden: i + 1,
    nombre: f.nombre,
    peso: Math.round((f.peso / sumaPesos) * 100),
  }));
}
