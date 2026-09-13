// Lo que hay que sacarle a un cliente para poder construirle un agente de IA.
//
// Dos capas:
//  - CAMPOS_AGENTE: lo que se pregunta siempre, sea cual sea el negocio. Sale
//    casi entero del prompt de sistema, de la configuracion del canal o del
//    presupuesto: si falta algo de aqui, el agente no se puede construir.
//  - NICHOS: lo que solo tiene sentido en ese sector.
//
// Para anadir un sector basta con meterlo en la lista de abajo: la pantalla de
// Diseno de oferta se monta sola a partir de estos datos.

export const CAMPOS_AGENTE = [
  {
    id: 'encargo',
    titulo: 'El encargo',
    porQue: 'Define que se construye y cuanto cuesta mantenerlo.',
    campos: [
      {
        clave: 'objetivo',
        etiqueta: '¿Que tiene que conseguir el agente?',
        tipo: 'opciones',
        opciones: ['Captar y cualificar', 'Agendar citas', 'Resolver dudas', 'Vender', 'Postventa', 'Cobrar / recordar pagos', 'Filtrar curiosos'],
      },
      {
        clave: 'canales',
        etiqueta: '¿Por donde habla con la gente?',
        tipo: 'opciones',
        opciones: ['WhatsApp', 'Web (chat)', 'Instagram', 'Facebook', 'Email', 'Telefono / voz'],
      },
      { clave: 'volumen', etiqueta: 'Conversaciones al mes (aproximado)', tipo: 'texto', pista: '200, 1.000, no lo sabe...' },
      {
        clave: 'horario',
        etiqueta: 'Horario de atencion y que pasa fuera de ese horario',
        tipo: 'area',
        pista: 'L-V 9-18. Fuera: recoge el mensaje y avisa de que responden por la manana.',
      },
      { clave: 'situacion', etiqueta: '¿Quien atiende hoy y como?', tipo: 'area', pista: 'Contesta la duena entre cliente y cliente; de noche no contesta nadie.' },
    ],
  },
  {
    id: 'voz',
    titulo: 'Como habla',
    porQue: 'Es el prompt de sistema: tono, tratamiento y lo que tiene prohibido decir.',
    campos: [
      { clave: 'tratamiento', etiqueta: 'Tratamiento', tipo: 'opciones', unica: true, opciones: ['De usted', 'De tu'] },
      { clave: 'tono', etiqueta: 'Tono', tipo: 'texto', pista: 'Cercano pero serio; nada de emojis' },
      { clave: 'idiomas', etiqueta: 'Idiomas', tipo: 'texto', pista: 'Espanol; catalan si escriben en catalan' },
      { clave: 'lineasRojas', etiqueta: 'Que NO puede hacer ni decir NUNCA', tipo: 'area', pista: 'No dar precios cerrados, no prometer plazos, no opinar de la competencia.' },
    ],
  },
  {
    id: 'saber',
    titulo: 'Lo que tiene que saber',
    porQue: 'Es la base de conocimiento. Sin material real, el agente se inventa cosas.',
    campos: [
      { clave: 'fuentes', etiqueta: '¿De donde saca la informacion?', tipo: 'opciones', opciones: ['Su web', 'Tarifas / catalogo', 'PDF o folleto', 'Hoja de calculo', 'Nada escrito todavia'] },
      { clave: 'faq', etiqueta: 'Las 5 preguntas que mas le hacen (literales)', tipo: 'area', pista: '¿Cuanto cuesta? ¿Cuanto tardais? ¿Trabajais en mi zona?...' },
      { clave: 'diferencial', etiqueta: '¿Por que le compran a el y no al de al lado?', tipo: 'area', pista: 'Lo que el agente tiene que repetir en cada conversacion.' },
    ],
  },
  {
    id: 'conexiones',
    titulo: 'Con que se conecta',
    porQue: 'Marca el trabajo tecnico real y que accesos hay que pedir antes de empezar.',
    campos: [
      { clave: 'integraciones', etiqueta: 'Herramientas con las que debe hablar', tipo: 'opciones', opciones: ['CRM', 'Calendario', 'Cobros / pagos', 'Hoja de calculo', 'ERP o software propio', 'Ninguna'] },
      { clave: 'cuales', etiqueta: '¿Cuales exactamente?', tipo: 'texto', pista: 'HubSpot, Google Calendar, Stripe, Odoo...' },
      { clave: 'accesos', etiqueta: 'Accesos pendientes y quien los da', tipo: 'area', pista: 'Numero de WhatsApp y alta en Meta, usuario de la web, API del CRM. Con nombre y fecha.' },
    ],
  },
  {
    id: 'economico',
    titulo: 'Modelo economico y compromisos',
    porQue: 'Lo que un comprador de agentes exige ver, y donde esta su margen.',
    campos: [
      {
        clave: 'modeloPrecio',
        etiqueta: '¿Como se le cobra?',
        tipo: 'opciones',
        opciones: ['Implantacion + cuota fija', 'Solo cuota fija', 'Coste por conversacion', 'Coste por resolucion', 'Hibrido: fija + variable', 'Por resultado (cita o venta)'],
      },
      { clave: 'importes', etiqueta: 'Importes', tipo: 'texto', pista: '2.900 € de alta + 290 €/mes · o 0,60 € por conversacion resuelta' },
      {
        clave: 'quienPagaModelo',
        etiqueta: '¿Quien paga el consumo de la IA y de WhatsApp?',
        tipo: 'opciones',
        unica: true,
        opciones: ['Lo paga el cliente en su cuenta', 'Va incluido en la cuota', 'Incluido hasta un tope, despues se factura', 'Pendiente de decidir'],
      },
      { clave: 'consumoEstimado', etiqueta: 'Consumo estimado al mes', tipo: 'texto', pista: '800 conversaciones ≈ 25 € de modelo + 12 € de WhatsApp' },
      { clave: 'sla', etiqueta: 'Que se compromete a cumplir y que pasa si falla', tipo: 'area', pista: 'Disponibilidad, en cuanto responde a una incidencia, y que compensa si se incumple.' },
      { clave: 'prueba', etiqueta: 'Periodo de prueba o piloto', tipo: 'texto', pista: '30 dias o 200 conversaciones' },
      { clave: 'permanencia', etiqueta: 'Permanencia y como se cancela', tipo: 'texto' },
    ],
  },
  {
    id: 'escalado',
    titulo: 'Cuando pasa a una persona',
    porQue: 'Un agente sin salida de emergencia quema clientes.',
    campos: [
      { clave: 'cuando', etiqueta: '¿En que casos deja de contestar y avisa?', tipo: 'area', pista: 'Reclamacion, presupuesto por encima de X, cliente enfadado, tres respuestas sin resolver.' },
      { clave: 'aQuien', etiqueta: '¿A quien avisa? (nombre y por donde)', tipo: 'texto', pista: 'Marta · WhatsApp 6XX XXX XXX' },
    ],
  },
  {
    id: 'legal',
    titulo: 'Cumplimiento',
    porQue: 'En la UE hay que avisar de que se habla con una IA, y los datos son del cliente.',
    campos: [
      { clave: 'avisoIA', etiqueta: '¿Se avisa de que es una IA?', tipo: 'opciones', unica: true, opciones: ['Si, al empezar la conversacion', 'Solo si lo preguntan', 'Pendiente de decidir'] },
      { clave: 'datos', etiqueta: '¿Que datos personales se van a tratar y donde se guardan?', tipo: 'area', pista: 'Nombre, telefono y direccion en el CRM. Ojo si hay datos de salud o menores.' },
      { clave: 'propiedadDatos', etiqueta: '¿De quien son las conversaciones?', tipo: 'opciones', unica: true, opciones: ['Del cliente', 'Compartidas', 'Pendiente de acordar'] },
      { clave: 'dpa', etiqueta: '¿Hay contrato de encargado de tratamiento firmado?', tipo: 'opciones', unica: true, opciones: ['Si', 'No, hay que prepararlo', 'Pendiente de revisar'] },
      { clave: 'retencion', etiqueta: '¿Cuanto se guardan las conversaciones y quien puede leerlas?', tipo: 'area', pista: '12 meses; solo la duena y quien lleva el soporte.' },
    ],
  },
  {
    id: 'exito',
    titulo: 'Como se sabe si ha salido bien',
    porQue: 'Sin cifra de partida no hay forma de defender la renovacion.',
    campos: [
      { clave: 'kpi', etiqueta: 'La cifra que tiene que mover', tipo: 'texto', pista: 'Citas al mes, presupuestos enviados, % de dudas resueltas sin humano' },
      { clave: 'partida', etiqueta: '¿En cuanto esta hoy?', tipo: 'texto', pista: '12 citas al mes' },
      { clave: 'meta', etiqueta: '¿En cuanto queremos dejarlo?', tipo: 'texto', pista: '25 citas al mes' },
    ],
  },
];

export const NICHOS = [
  {
    id: 'reformas',
    etiqueta: 'Reformas y obra',
    campos: [
      { clave: 'tipos', etiqueta: 'Obras que acepta y las que rechaza', tipo: 'area', pista: 'Integrales si; solo pintura no.' },
      { clave: 'zona', etiqueta: 'Zona de trabajo', tipo: 'texto', pista: 'Alicante y 50 km' },
      { clave: 'ticket', etiqueta: 'Obra minima y ticket medio', tipo: 'texto', pista: 'Minimo 6.000 € · medio 22.000 €' },
      { clave: 'datosPresupuesto', etiqueta: '¿Que necesita saber para orientar un precio?', tipo: 'area', pista: 'Metros, estancia, estado actual, fotos, si esta habitada.' },
      { clave: 'visita', etiqueta: '¿Visita para presupuestar? ¿Gratis?', tipo: 'texto', pista: 'Si, gratuita, en 48 h' },
      { clave: 'plazos', etiqueta: 'Plazo desde el si hasta empezar', tipo: 'texto', pista: '3 semanas' },
    ],
  },
  {
    id: 'clinica',
    etiqueta: 'Clinica y salud',
    campos: [
      { clave: 'tratamientos', etiqueta: 'Tratamientos y duracion de cada cita', tipo: 'area' },
      { clave: 'profesionales', etiqueta: 'Profesionales y sus agendas', tipo: 'area' },
      { clave: 'software', etiqueta: 'Software de citas e historia clinica', tipo: 'texto' },
      { clave: 'cancelacion', etiqueta: 'Politica de cancelacion y senal', tipo: 'texto' },
      { clave: 'sensibles', etiqueta: 'Datos de salud: que se puede preguntar por el canal', tipo: 'area', pista: 'Categoria especial del RGPD: por norma, ni sintomas ni diagnosticos por WhatsApp.' },
      { clave: 'prohibido', etiqueta: 'Que no puede responder jamas', tipo: 'area', pista: 'Nada que suene a diagnostico ni a consejo medico.' },
    ],
  },
  {
    id: 'belleza',
    etiqueta: 'Salon de belleza y estetica',
    campos: [
      { clave: 'servicios', etiqueta: 'Servicios, duracion y precio', tipo: 'area' },
      { clave: 'profesionales', etiqueta: 'Profesionales y horarios de cada uno', tipo: 'area' },
      { clave: 'senal', etiqueta: '¿Se reserva con senal? ¿Cuanta?', tipo: 'texto' },
      { clave: 'noPresentados', etiqueta: 'Que hacer con quien no aparece', tipo: 'texto' },
      { clave: 'venta', etiqueta: 'Productos que se pueden ofrecer de paso', tipo: 'texto' },
    ],
  },
  {
    id: 'restauracion',
    etiqueta: 'Restauracion',
    campos: [
      { clave: 'aforo', etiqueta: 'Aforo, turnos y dias de cierre', tipo: 'area' },
      { clave: 'grupos', etiqueta: 'Reservas de grupo: desde cuantos y con que condiciones', tipo: 'texto' },
      { clave: 'carta', etiqueta: 'Carta y alergenos (¿donde esta?)', tipo: 'texto' },
      { clave: 'reparto', etiqueta: '¿Reparto o recogida? ¿Con que plataforma?', tipo: 'texto' },
    ],
  },
  {
    id: 'inmobiliaria',
    etiqueta: 'Inmobiliaria',
    campos: [
      { clave: 'cartera', etiqueta: 'Zonas y tipo de producto', tipo: 'area' },
      { clave: 'requisitos', etiqueta: 'Requisitos para agendar una visita', tipo: 'area', pista: 'Financiacion aprobada, nomina, entrada disponible...' },
      { clave: 'capta', etiqueta: '¿Capta propiedad? ¿Hace valoraciones?', tipo: 'texto' },
      { clave: 'crm', etiqueta: 'CRM o portal donde vive la cartera', tipo: 'texto' },
    ],
  },
  {
    id: 'telecom',
    etiqueta: 'Telecom y servicios con cuota',
    campos: [
      { clave: 'tarifas', etiqueta: 'Tarifas vigentes y permanencia', tipo: 'area' },
      { clave: 'cobertura', etiqueta: '¿Como se comprueba la cobertura?', tipo: 'texto' },
      { clave: 'alta', etiqueta: 'Datos que hacen falta para un alta o portabilidad', tipo: 'area' },
      { clave: 'impagos', etiqueta: 'Que hace el agente ante un impago o una baja', tipo: 'area' },
    ],
  },
  {
    id: 'asesoria',
    etiqueta: 'Asesoria y despacho profesional',
    campos: [
      { clave: 'servicios', etiqueta: 'Servicios y cuotas', tipo: 'area' },
      { clave: 'documentacion', etiqueta: 'Documentacion que pide para dar de alta a un cliente', tipo: 'area' },
      { clave: 'plazos', etiqueta: 'Plazos que disparan avisos automaticos', tipo: 'texto', pista: 'Trimestrales, renta, modelo 347...' },
      { clave: 'software', etiqueta: 'Software que usan', tipo: 'texto' },
    ],
  },
  {
    id: 'formacion',
    etiqueta: 'Formacion y academia',
    campos: [
      { clave: 'catalogo', etiqueta: 'Cursos, precios y proximas fechas', tipo: 'area' },
      { clave: 'requisitos', etiqueta: 'Requisitos de acceso', tipo: 'texto' },
      { clave: 'financiacion', etiqueta: 'Financiacion, becas o pago a plazos', tipo: 'texto' },
      { clave: 'plataforma', etiqueta: 'Plataforma donde se imparte', tipo: 'texto' },
    ],
  },
  {
    id: 'ecommerce',
    etiqueta: 'Tienda online',
    campos: [
      { clave: 'plataforma', etiqueta: 'Plataforma de la tienda', tipo: 'texto', pista: 'Shopify, WooCommerce...' },
      { clave: 'devoluciones', etiqueta: 'Politica de devoluciones y plazos', tipo: 'area' },
      { clave: 'pedidos', etiqueta: '¿El agente consulta el estado del pedido? ¿Contra que?', tipo: 'texto' },
      { clave: 'catalogo', etiqueta: 'Tamano del catalogo y cada cuanto cambia', tipo: 'texto' },
    ],
  },
  {
    id: 'otro',
    etiqueta: 'Otro sector',
    campos: [
      { clave: 'queHace', etiqueta: '¿A que se dedica exactamente?', tipo: 'area' },
      { clave: 'proceso', etiqueta: 'Como entra hoy un cliente nuevo, paso a paso', tipo: 'area' },
      { clave: 'particular', etiqueta: 'Que tiene este sector que no tengan los demas', tipo: 'area' },
    ],
  },
];

export function buscarNicho(id) {
  return NICHOS.find((n) => n.id === id);
}

// Campos sin los que no se puede ni construir el agente ni cerrar el trato.
export const IMPRESCINDIBLES = ['objetivo', 'canales', 'horario', 'lineasRojas', 'fuentes', 'cuando', 'aQuien', 'modeloPrecio', 'quienPagaModelo'];

// Los 4 criterios del scorecard.
export const CRITERIOS = [
  { clave: 'complementa', etiqueta: 'Complementa la oferta', ayuda: '¿Encaja con lo demas o va suelto?' },
  { clave: 'objecion', etiqueta: 'Rompe una objecion', ayuda: '¿Desactiva un "no" concreto del cliente?' },
  { clave: 'valor', etiqueta: 'Valor percibido', ayuda: '¿Lo valora el cliente o solo usted?' },
  { clave: 'esfuerzo', etiqueta: 'Bajo esfuerzo de entregar', ayuda: '5 = casi no le cuesta entregarlo.' },
];

export const TOTAL_MAX = CRITERIOS.length * 5;

export function totalPuntos(p) {
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  return n(p?.complementa) + n(p?.objecion) + n(p?.valor) + n(p?.esfuerzo);
}
