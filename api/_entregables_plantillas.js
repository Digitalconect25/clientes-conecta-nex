// Plantillas de entregables segun los servicios contratados.
// Cuando Lazaro genera la lista inicial, el sistema mira las categorias
// de los servicios del cliente y combina los entregables sin duplicar.

export const PLANTILLAS_ENTREGABLES = {
  'Webs y landings': [
    'Briefing y materiales recibidos',
    'Wireframe / arquitectura aprobada',
    'Diseno visual aprobado',
    'Web desarrollada',
    'Pruebas y revisiones',
    'Hosting configurado',
    'Dominio configurado',
    'Email profesional creado',
    'Web publicada',
    'Formacion al cliente',
  ],
  'Identidad': [
    'Briefing de marca',
    'Logo principal entregado',
    'Versiones del logo (color, b/n, vertical, horizontal)',
    'Paleta de colores definida',
    'Tipografias seleccionadas',
    'Manual de marca PDF',
    'Aplicaciones (papeleria, redes)',
  ],
  'Diseno Canva': [
    'Briefing visual',
    'Diseno de piezas aprobado',
    'Plantillas Canva entregadas',
    'Acceso a la cuenta de Canva',
  ],
  'Codigos QR': [
    'QR generado',
    'Diseno con marca',
    'Archivos para imprimir entregados',
    'Pruebas de escaneo realizadas',
  ],
  'Redes y Google': [
    'Auditoria inicial de perfiles',
    'Optimizacion Instagram',
    'Optimizacion Facebook',
    'Ficha Google Business creada/optimizada',
    'Acceso entregado al cliente',
  ],
  'Bots': [
    'Briefing y casos de uso definidos',
    'Cuenta de WhatsApp Business configurada',
    'Flujos de conversacion construidos',
    'Bot probado con cliente',
    'Lanzamiento en produccion',
    'Formacion al cliente',
  ],
  'Mensual': [
    'Onboarding inicial completado',
    'Acceso entregado al cliente',
  ],
  'Combos': [
    'Briefing y materiales recibidos',
    'Identidad de marca completada',
    'Web desarrollada',
    'Hosting y dominio configurados',
    'Perfiles sociales optimizados',
    'Web publicada',
    'Formacion al cliente',
  ],
  'Otros': [
    'Definicion del trabajo',
    'Ejecucion completada',
    'Entrega al cliente',
  ],
  'Personalizado': [
    'Definicion del trabajo',
    'Ejecucion completada',
    'Entrega al cliente',
  ],
};

export const PLANTILLA_GENERICA = [
  'Briefing inicial',
  'Trabajo principal',
  'Revision con cliente',
  'Entrega final',
];

// Recibe un array de categorias y devuelve una lista combinada de
// entregables, sin duplicados, en orden coherente.
export function construirEntregablesDesdeCategorias(categorias) {
  const cats = categorias && categorias.length > 0 ? categorias : ['Otros'];
  const lista = [];
  const vistos = new Set();
  cats.forEach((cat, idxCat) => {
    const items = PLANTILLAS_ENTREGABLES[cat] || PLANTILLA_GENERICA;
    items.forEach((nombre) => {
      if (!vistos.has(nombre)) {
        vistos.add(nombre);
        lista.push({
          nombre,
          categoria: cat,
          orden: lista.length + 1,
        });
      }
    });
  });
  return lista;
}
