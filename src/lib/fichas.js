// Definicion compartida de las "Fichas de implementacion" (ficha de descubrimiento
// del agente IA de WhatsApp). La usan tanto el backend (api/ficha.js, api/fichas.js
// para validar y renderizar) como el frontend (src/pages/Ficha.jsx, Fichas.jsx para
// pintar el formulario). Una sola fuente de verdad: anadir un campo aqui lo anade
// a la vez al formulario publico y a la validacion de obligatorios.
//
// Basado en "Ficha de implementacion del agente IA - WhatsApp para empresas y
// negocios" (Conecta NEX). Cada seccion se puede activar o no por ficha (el admin
// elige que apartados necesita ese cliente). La firma (seccion 14 del documento
// original) no es una seccion mas: es el paso final de la pagina publica.

export const SECCIONES_FICHA = [
  {
    clave: 'proyecto',
    numero: '01',
    titulo: 'Datos del proyecto',
    subtitulo: 'Empresa y responsables: identificacion, contacto y autorizaciones',
    campos: [
      { clave: 'nombre_comercial', etiqueta: 'Nombre comercial', tipo: 'texto', requerido: true, ancho: 4 },
      { clave: 'razon_social', etiqueta: 'Razon social', tipo: 'texto', ancho: 4 },
      { clave: 'cif_nif', etiqueta: 'CIF o NIF', tipo: 'texto', requerido: true, ancho: 4 },
      { clave: 'representante', etiqueta: 'Representante', tipo: 'texto', requerido: true, ancho: 4 },
      { clave: 'cargo_representante', etiqueta: 'Cargo', tipo: 'texto', ancho: 4 },
      { clave: 'telefono', etiqueta: 'Telefono', tipo: 'texto', ancho: 4 },
      { clave: 'correo', etiqueta: 'Correo', tipo: 'texto', requerido: true, ancho: 4 },
      { clave: 'web', etiqueta: 'Web', tipo: 'texto', ancho: 4 },
      { clave: 'sector', etiqueta: 'Sector', tipo: 'texto', ancho: 4 },
      { clave: 'actividad_zonas_canales', etiqueta: 'Actividad, zonas atendidas y canales actuales', tipo: 'textarea' },
      { clave: 'personas_autorizadas', etiqueta: 'Personas autorizadas para aprobar contenido, accesos y publicacion', tipo: 'textarea' },
      { clave: 'fecha_objetivo', etiqueta: 'Fecha objetivo', tipo: 'texto', ancho: 4 },
      { clave: 'horario_humano', etiqueta: 'Horario humano', tipo: 'texto', ancho: 4 },
      { clave: 'zona_horaria', etiqueta: 'Zona horaria', tipo: 'texto', ancho: 4 },
      { clave: 'descripcion_proyecto', etiqueta: 'Descripcion breve del proyecto y resultado esperado', tipo: 'textarea' },
    ],
  },
  {
    clave: 'negocio',
    numero: '02',
    titulo: 'Negocio',
    subtitulo: 'Necesidad y objetivo: informacion suficiente para definir prioridades',
    campos: [
      { clave: 'problema_principal', etiqueta: 'Problema principal que debe resolver el agente', ayuda: 'Explique que ocurre hoy, su frecuencia y su impacto.', tipo: 'textarea' },
      { clave: 'problemas_actuales', etiqueta: 'Problemas actuales', tipo: 'checkbox_grupo', opciones: ['Respuesta tardia', 'Consultas repetidas', 'Contactos incompletos', 'Ventas perdidas', 'Errores en pedidos', 'Agenda saturada', 'Falta de seguimiento', 'Sobrecarga del equipo', 'Otro'] },
      { clave: 'tareas_concretas', etiqueta: 'Tareas concretas que debe realizar el agente', tipo: 'textarea' },
      { clave: 'ticket_medio', etiqueta: 'Ticket medio', tipo: 'texto', ancho: 4 },
      { clave: 'operaciones_mes', etiqueta: 'Operaciones al mes', tipo: 'texto', ancho: 4 },
      { clave: 'objetivo_mensual', etiqueta: 'Objetivo mensual', tipo: 'texto', ancho: 4 },
      { clave: 'cliente_principal', etiqueta: 'Cliente principal y necesidades habituales', tipo: 'textarea' },
      { clave: 'resultados_90_dias', etiqueta: 'Tres resultados medibles para los primeros 90 dias', tipo: 'textarea' },
    ],
  },
  {
    clave: 'oferta',
    numero: '03',
    titulo: 'Oferta',
    subtitulo: 'Productos, servicios y condiciones: fuente comercial autorizada',
    campos: [
      { clave: 'productos_servicios', etiqueta: 'Productos, servicios, planes o categorias principales', tipo: 'textarea' },
      { clave: 'datos_por_referencia', etiqueta: 'Datos disponibles por referencia', ayuda: 'Codigo, nombre, descripcion, variante, precio, impuestos, stock o disponibilidad, plazo y condiciones.', tipo: 'textarea' },
      { clave: 'opciones_prioritarias', etiqueta: 'Opciones prioritarias, mayor margen y venta adicional autorizada', tipo: 'textarea' },
      { clave: 'precios_promociones', etiqueta: 'Precios, descuentos y promociones vigentes', ayuda: 'Fuente oficial, fechas, limites e incompatibilidades.', tipo: 'textarea' },
      { clave: 'restricciones_exclusiones', etiqueta: 'Restricciones, exclusiones y opciones que nunca debe ofrecer', tipo: 'textarea' },
      { clave: 'archivos_fuente', etiqueta: 'Archivos entregados como fuente', ayuda: 'Catalogo, tarifas, fichas, contratos, politicas, imagenes y preguntas frecuentes.', tipo: 'textarea' },
    ],
  },
  {
    clave: 'conversacion',
    numero: '04',
    titulo: 'Conversacion',
    subtitulo: 'Atencion y recogida de datos: flujo desde el saludo hasta el cierre',
    campos: [
      { clave: 'datos_necesarios', etiqueta: 'Datos que puede necesitar', tipo: 'checkbox_grupo', opciones: ['Nombre', 'Telefono', 'Correo', 'Empresa', 'CIF o NIF', 'Direccion', 'Codigo postal', 'Necesidad', 'Presupuesto', 'Producto o servicio', 'Fecha', 'Cantidad', 'Pago', 'Consentimiento', 'Otro'] },
      { clave: 'preguntas_obligatorias_orden', etiqueta: 'Preguntas obligatorias y orden de la conversacion', tipo: 'textarea' },
      { clave: 'datos_no_solicitar', etiqueta: 'Datos que no debe solicitar', ayuda: 'Excluya todo dato que no sea necesario para la finalidad declarada.', tipo: 'textarea' },
      { clave: 'saludo_inicial', etiqueta: 'Saludo inicial indicando claramente que es un asistente de IA', tipo: 'textarea' },
      { clave: 'mensaje_cierre', etiqueta: 'Mensaje de cierre y resumen que debe confirmar el usuario', tipo: 'textarea' },
      { clave: 'idiomas_tono', etiqueta: 'Idiomas, tono, expresiones permitidas y expresiones prohibidas', tipo: 'textarea' },
    ],
  },
  {
    clave: 'operaciones',
    numero: '05',
    titulo: 'Operaciones',
    subtitulo: 'Acciones, pedidos y reservas: complete solo los procesos aplicables',
    campos: [
      { clave: 'acciones_autorizadas', etiqueta: 'Acciones autorizadas', tipo: 'checkbox_grupo', opciones: ['Responder', 'Capturar datos', 'Calificar contacto', 'Recomendar', 'Crear pedido', 'Reservar cita', 'Reprogramar', 'Cancelar', 'Consultar estado', 'Enviar documento', 'Solicitar pago', 'Crear incidencia'] },
      { clave: 'comprobaciones_previas', etiqueta: 'Datos y comprobaciones antes de ejecutar una accion', tipo: 'textarea' },
      { clave: 'proceso_pedido', etiqueta: 'Proceso de pedido o contratacion', ayuda: 'Estados, responsable, confirmacion, cambios y cancelaciones.', tipo: 'textarea' },
      { clave: 'proceso_cita', etiqueta: 'Proceso de cita o reserva', ayuda: 'Servicios, duracion, disponibilidad, senal, recordatorio y politica de ausencia.', tipo: 'textarea' },
      { clave: 'metodos_pago', etiqueta: 'Metodos de pago y facturacion', tipo: 'textarea' },
      { clave: 'limites_aprobacion_humana', etiqueta: 'Limites que requieren aprobacion humana', ayuda: 'Importe, cantidad, territorio, horario, cliente o tipo de operacion.', tipo: 'textarea' },
    ],
  },
  {
    clave: 'logistica',
    numero: '06',
    titulo: 'Logistica y posventa',
    subtitulo: 'Entrega, seguimiento e incidencias: reglas operativas que debe comunicar',
    campos: [
      { clave: 'envios_zonas_costes', etiqueta: 'Envios, recogida, zonas, costes y plazos', tipo: 'textarea' },
      { clave: 'fuente_stock', etiqueta: 'Fuente y frecuencia de actualizacion de stock o disponibilidad', tipo: 'textarea' },
      { clave: 'seguimiento_posterior', etiqueta: 'Seguimiento posterior permitido', ayuda: 'Canal, frecuencia, numero maximo de intentos y condicion para detenerlo.', tipo: 'textarea' },
      { clave: 'cambios_devoluciones', etiqueta: 'Cambios, cancelaciones, devoluciones y reembolsos', tipo: 'textarea' },
      { clave: 'incidencias_respuesta', etiqueta: 'Incidencias habituales y respuesta aprobada', tipo: 'textarea' },
      { clave: 'datos_crm', etiqueta: 'Datos que debe registrar en CRM o sistema interno', tipo: 'textarea' },
      { clave: 'asignacion_equipo', etiqueta: 'Asignacion de contactos o incidencias al equipo', tipo: 'textarea' },
    ],
  },
  {
    clave: 'limites',
    numero: '07',
    titulo: 'Limites',
    subtitulo: 'Reglas del sector y derivacion: casos que requieren intervencion humana',
    campos: [
      { clave: 'areas_sensibles', etiqueta: 'Areas sensibles', tipo: 'checkbox_grupo', opciones: ['Salud', 'Legal', 'Finanzas', 'Seguros', 'Menores', 'Datos sensibles', 'Credito', 'Productos regulados', 'Emergencias', 'Ninguna', 'Otra'] },
      { clave: 'normativa_aplicable', etiqueta: 'Normativa, licencias o restricciones aplicables', tipo: 'textarea' },
      { clave: 'afirmaciones_prohibidas', etiqueta: 'Afirmaciones, recomendaciones o compromisos prohibidos', tipo: 'textarea' },
      { clave: 'derivacion_inmediata', etiqueta: 'Derivacion inmediata', tipo: 'checkbox_grupo', opciones: ['Riesgo o emergencia', 'Consulta regulada', 'Cliente enfadado', 'Pago dudoso', 'Reclamacion', 'Dato no verificado', 'Solicitud humana', 'Operacion de alto valor', 'Otro'] },
      { clave: 'equipo_receptor', etiqueta: 'Equipo receptor, horario y tiempo objetivo de respuesta', tipo: 'textarea' },
      { clave: 'mensaje_derivacion', etiqueta: 'Mensaje de derivacion y resumen que recibira el empleado', tipo: 'textarea' },
      { clave: 'protocolo_pausa', etiqueta: 'Protocolo para pausar el agente ante un error grave', tipo: 'textarea' },
    ],
  },
  {
    clave: 'sistemas',
    numero: '08',
    titulo: 'Sistemas',
    subtitulo: 'WhatsApp e integraciones: accesos mediante invitacion y permisos minimos',
    campos: [
      { clave: 'estado_whatsapp', etiqueta: 'Estado de WhatsApp', tipo: 'checkbox_grupo', opciones: ['Numero nuevo', 'WhatsApp Business App', 'WhatsApp API', 'Meta verificado', 'Proveedor actual', 'Estado desconocido'] },
      { clave: 'numero_titular_meta', etiqueta: 'Numero, titular y cuenta de Meta asociada', tipo: 'textarea' },
      { clave: 'sistemas_conectar', etiqueta: 'Sistemas a conectar', tipo: 'checkbox_grupo', opciones: ['CRM', 'Correo', 'Calendario', 'Web', 'Tienda online', 'Pagos', 'Inventario o ERP', 'Hoja de calculo', 'Transporte', 'Otro'] },
      { clave: 'datos_leidos_escritos', etiqueta: 'Que datos se leen y escriben en cada sistema', tipo: 'textarea' },
      { clave: 'avisos_automatizaciones', etiqueta: 'Avisos y automatizaciones internas', tipo: 'textarea' },
      { clave: 'propietario_responsable_tecnico', etiqueta: 'Propietario de cuentas, responsable tecnico y canal seguro para accesos', tipo: 'textarea' },
      { clave: 'retirada_permisos', etiqueta: 'Retirada de permisos, copias y continuidad al finalizar', tipo: 'textarea' },
    ],
  },
  {
    clave: 'proteccion_datos',
    numero: '09',
    titulo: 'Proteccion de datos',
    subtitulo: 'Mapa del tratamiento: datos necesarios para valorar el cumplimiento',
    nota: 'El cliente suele ser responsable del tratamiento y la agencia encargada cuando trata datos por sus instrucciones. La funcion exacta debe confirmarse segun el servicio real.',
    campos: [
      { clave: 'finalidades_tratamiento', etiqueta: 'Finalidades concretas del tratamiento', tipo: 'textarea' },
      { clave: 'base_juridica', etiqueta: 'Base juridica prevista', tipo: 'checkbox_grupo', opciones: ['Contrato o medidas precontractuales', 'Consentimiento', 'Obligacion legal', 'Interes legitimo evaluado', 'Otra'] },
      { clave: 'categorias_interesados', etiqueta: 'Categorias de interesados y datos personales', ayuda: 'Clientes, contactos, empleados u otros. Identificativos, contacto, pedidos, pagos u otras categorias.', tipo: 'textarea' },
      { clave: 'datos_riesgo_especial', etiqueta: 'Datos de riesgo especial', tipo: 'checkbox_grupo', opciones: ['Salud', 'Biometricos', 'Origen racial o etnico', 'Religion', 'Ideologia', 'Vida sexual', 'Afiliacion sindical', 'Datos penales', 'Menores', 'No se trataran'] },
      { clave: 'plazo_conservacion', etiqueta: 'Plazo de conservacion y criterio de borrado', tipo: 'textarea' },
      { clave: 'canal_derechos', etiqueta: 'Canal para derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad', tipo: 'textarea' },
    ],
  },
  {
    clave: 'privacidad',
    numero: '10',
    titulo: 'Privacidad',
    subtitulo: 'Informacion y proveedores: transparencia, destinatarios y transferencias',
    campos: [
      { clave: 'responsable_dpd', etiqueta: 'Identidad y contacto del responsable y, si existe, del delegado de proteccion de datos', tipo: 'textarea' },
      { clave: 'texto_privacidad', etiqueta: 'Texto o enlace de privacidad que mostrara el agente', ayuda: 'Debe informar de finalidad, base juridica, destinatarios, conservacion, derechos y reclamacion ante la AEPD.', tipo: 'textarea' },
      { clave: 'proveedores_subencargados', etiqueta: 'Proveedores y subencargados previstos', ayuda: 'Meta WhatsApp, alojamiento, modelo de IA, automatizacion, CRM y otros.', tipo: 'textarea' },
      { clave: 'ubicacion_transferencias', etiqueta: 'Ubicacion del tratamiento y transferencias fuera del EEE', ayuda: 'Pais, proveedor y garantia aplicable. No lo deje sin verificar.', tipo: 'textarea' },
      { clave: 'uso_secundario_conversaciones', etiqueta: 'Uso secundario de conversaciones', ayuda: 'Analitica, mejora, marketing o entrenamiento. Separe finalidades y bases juridicas.', tipo: 'textarea' },
      { clave: 'comunicaciones_comerciales', etiqueta: 'Comunicaciones comerciales por WhatsApp', ayuda: 'Origen del contacto, autorizacion aplicable, prueba y mecanismo sencillo de baja.', tipo: 'textarea' },
      { clave: 'evaluacion_impacto', etiqueta: 'Necesidad de evaluacion de impacto y motivo', ayuda: 'Valorarla si puede existir alto riesgo, perfiles, gran escala o datos sensibles.', tipo: 'textarea' },
    ],
  },
  {
    clave: 'seguridad',
    numero: '11',
    titulo: 'Seguridad',
    subtitulo: 'Medidas e incidentes: controles proporcionales al riesgo',
    campos: [
      { clave: 'medidas_previstas', etiqueta: 'Medidas previstas', tipo: 'checkbox_grupo', opciones: ['Usuarios individuales', 'Minimo privilegio', 'Doble factor', 'Cifrado', 'Copias de seguridad', 'Registro de actividad', 'Separacion por cliente', 'Entorno de pruebas', 'Borrado seguro', 'Revision periodica'] },
      { clave: 'personas_autorizadas_confidencialidad', etiqueta: 'Personas autorizadas y deber de confidencialidad', tipo: 'textarea' },
      { clave: 'procedimiento_altas_bajas', etiqueta: 'Procedimiento de alta, cambio y baja de usuarios', tipo: 'textarea' },
      { clave: 'deteccion_incidentes', etiqueta: 'Deteccion, registro y comunicacion de incidentes', ayuda: 'Responsables, canales y plazos internos. El encargado debe avisar sin dilacion indebida al responsable.', tipo: 'textarea' },
      { clave: 'recuperacion_continuidad', etiqueta: 'Recuperacion, continuidad y pruebas de seguridad', tipo: 'textarea' },
      { clave: 'destino_datos_final', etiqueta: 'Destino de los datos al finalizar el servicio', ayuda: 'Devolucion, portabilidad, eliminacion y copias sujetas a obligacion legal.', tipo: 'textarea' },
      { clave: 'responsable_revision', etiqueta: 'Responsable de revisar las medidas y frecuencia', tipo: 'textarea' },
    ],
  },
  {
    clave: 'entrenamiento',
    numero: '12',
    titulo: 'Entrenamiento y pruebas',
    subtitulo: 'Fuentes, aprobacion y control: comprobacion previa a la publicacion',
    campos: [
      { clave: 'fuentes_autorizadas', etiqueta: 'Fuentes autorizadas y orden de prioridad', tipo: 'textarea' },
      { clave: 'preguntas_frecuentes', etiqueta: 'Preguntas frecuentes y respuestas aprobadas', tipo: 'textarea' },
      { clave: 'responsable_actualizar', etiqueta: 'Responsable de actualizar informacion y frecuencia', tipo: 'textarea' },
      { clave: 'pruebas_obligatorias', etiqueta: 'Pruebas obligatorias', tipo: 'checkbox_grupo', opciones: ['Consulta normal', 'Dato incompleto', 'Dato sensible', 'Opcion agotada', 'Precio incorrecto', 'Promocion vencida', 'Accion completa', 'Derivacion', 'Cliente enfadado', 'Fallo de sistema', 'Baja comercial', 'Fuera de horario'] },
      { clave: 'errores_bloqueantes', etiqueta: 'Errores que impiden publicar y criterio de aprobacion', tipo: 'textarea' },
      { clave: 'indicadores_seguimiento', etiqueta: 'Indicadores de seguimiento y frecuencia de revision', tipo: 'textarea' },
      { clave: 'personal_formacion', etiqueta: 'Personal que usara el sistema y formacion en IA prevista', tipo: 'textarea' },
    ],
  },
  {
    clave: 'autorizacion',
    numero: '13',
    titulo: 'Autorizacion',
    subtitulo: 'Datos materiales y accesos: autorizacion limitada al servicio contratado',
    nota: 'Esta ficha no sustituye el contrato de encargo del tratamiento exigido por el articulo 28 del RGPD cuando la agencia trate datos personales por cuenta del cliente.',
    campos: [
      { clave: 'datos_excluidos_reservas', etiqueta: 'Datos excluidos, reservas o instrucciones adicionales', tipo: 'textarea' },
      {
        clave: 'confirmaciones', etiqueta: 'Confirmacion del cliente', tipo: 'checkbox_grupo', requerido: true,
        opciones: ['La informacion facilitada es correcta', 'Autoriza el uso limitado descrito', 'No ha incluido credenciales en la ficha', 'Acepta la supervision y derivacion definidas'],
      },
    ],
  },
];

export function seccionesActivas(clavesActivas) {
  const set = new Set(clavesActivas || []);
  return SECCIONES_FICHA.filter((s) => set.has(s.clave));
}

// Devuelve la lista de etiquetas de campos obligatorios que faltan por rellenar,
// mirando solo las secciones que esta ficha tiene activas. Un checkbox_grupo
// "requerido" exige que TODAS sus opciones esten marcadas (p.ej. las 4
// declaraciones de la seccion Autorizacion); el resto de campos requeridos
// solo piden texto no vacio.
export function camposFaltantes(clavesActivas, contenido) {
  const cont = contenido || {};
  const faltan = [];
  for (const seccion of seccionesActivas(clavesActivas)) {
    for (const campo of seccion.campos) {
      if (!campo.requerido) continue;
      const valor = cont[seccion.clave]?.[campo.clave];
      if (campo.tipo === 'checkbox_grupo') {
        const marcadas = Array.isArray(valor) ? valor : [];
        const faltaAlguna = campo.opciones.some((op) => !marcadas.includes(op));
        if (faltaAlguna) faltan.push(`${seccion.titulo}: ${campo.etiqueta}`);
      } else if (!String(valor || '').trim()) {
        faltan.push(`${seccion.titulo}: ${campo.etiqueta}`);
      }
    }
  }
  return faltan;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function nl2p(s) {
  const t = esc(s).trim();
  if (!t) return '<p style="color:#999">(Sin completar)</p>';
  return t.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

const CSS_FICHA = `
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; color: #047857; font-size: 18pt; margin: 10px 0 5px; }
  .sub { text-align: center; color: #666; font-size: 10pt; margin-bottom: 20px; }
  h2 { color: #047857; font-size: 12.5pt; margin-top: 22px; border-bottom: 1px solid #047857; padding-bottom: 3px; page-break-after: avoid; }
  h3 { color: #333; font-size: 10.5pt; margin: 12px 0 4px; }
  .nota { background: #f0fdf4; border-left: 3px solid #047857; padding: 8px 12px; font-size: 9.5pt; color: #333; margin: 6px 0 12px; }
  .chips { margin: 4px 0 10px; }
  .chip { display: inline-block; background: #f0fdf4; border: 1px solid #cfe9d8; color: #0c7b6d; border-radius: 12px; padding: 2px 10px; font-size: 9pt; margin: 2px 4px 2px 0; }
  p { margin: 4px 0 10px; }
</style>`;

function cabeceraLogo(emisor) {
  const origen = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://clientes.conectanex.com';
  const url = (emisor && emisor.logo_data_url) || (origen + '/logo-email.png');
  return `<div style="text-align:center;margin-bottom:16px"><img src="${url}" alt="Conecta Nex" style="max-height:70px;max-width:280px"/></div>`;
}

function bloqueSeccion(seccion, respuestas) {
  const r = respuestas || {};
  let html = `<h2>${seccion.numero} · ${esc(seccion.titulo)}</h2>`;
  if (seccion.nota) html += `<div class="nota">${esc(seccion.nota)}</div>`;
  for (const campo of seccion.campos) {
    const valor = r[campo.clave];
    html += `<h3>${esc(campo.etiqueta)}</h3>`;
    if (campo.tipo === 'checkbox_grupo') {
      const marcadas = Array.isArray(valor) ? valor : [];
      if (!marcadas.length) { html += '<p style="color:#999">(Ninguna marcada)</p>'; continue; }
      html += '<div class="chips">' + marcadas.map((op) => `<span class="chip">✓ ${esc(op)}</span>`).join('') + '</div>';
    } else {
      html += nl2p(valor);
    }
  }
  return html;
}

// Bloque de firmas al pie de la ficha: representante de la agencia (firma
// precargada desde "Mis datos", igual que en los contratos) + firmante del cliente.
function bloqueFirmaFicha(ficha, emisor) {
  const meta = ficha.contenido?.firma || {};
  const imgAgencia = emisor?.firma_emisor ? `<img src="${emisor.firma_emisor}" style="max-width:180px;max-height:70px;display:block;margin:0 auto 5px"/>` : '<div style="height:55px"></div>';
  const imgCliente = ficha.firma_img ? `<img src="${ficha.firma_img}" style="max-width:180px;max-height:70px;display:block;margin:0 auto 5px"/>` : '<div style="height:55px"></div>';
  return `
<h2>14 · Firma</h2>
<p><b>Razon social:</b> ${esc(meta.razon_social_cliente || '')} &nbsp; <b>CIF/NIF:</b> ${esc(meta.cif_nif_cliente || '')}</p>
<p><b>Representante:</b> ${esc(ficha.firmante_nombre || meta.representante || '')} &nbsp; <b>DNI/NIE:</b> ${esc(ficha.firmante_nif || meta.dni_nie || '')} &nbsp; <b>Cargo:</b> ${esc(ficha.firmante_cargo || meta.cargo || '')}</p>
<p><b>Lugar:</b> ${esc(meta.lugar || '')} &nbsp; <b>Version:</b> ${esc(String(ficha.version || 1))}</p>
<h3>Funciones aprobadas para la primera version</h3>
${nl2p(meta.funciones_aprobadas)}
<h3>Pendientes, exclusiones y condiciones de aprobacion</h3>
${nl2p(meta.pendientes_exclusiones)}
<div style="display:flex;justify-content:space-between;margin-top:30px;gap:40px">
  <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
    ${imgAgencia}<strong>Representante de la agencia</strong><br>${esc(emisor?.nombre || '')}<br>NIF: ${esc(emisor?.nif || '')}
  </div>
  <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
    ${imgCliente}<strong>Firma del cliente</strong><br>${esc(ficha.firmante_nombre || '')}<br>${esc(ficha.firmante_nif ? 'DNI/NIE: ' + ficha.firmante_nif : '')}
  </div>
</div>
<p style="font-size:8.5pt;color:#666;margin-top:16px">Marco de referencia: RGPD (Reglamento UE 2016/679), LOPDGDD (Ley Organica 3/2018), Reglamento de IA (Reglamento UE 2024/1689) y LSSI (Ley 34/2002), cuando resulte aplicable. La adecuacion final depende del sector, funciones, proveedores y flujos reales.</p>`;
}

// Renderiza la ficha completa (secciones activas + respuestas) como HTML imprimible.
// `incluirFirma` se pone a false para calcular el hash de evidencia SOBRE el
// contenido tal cual estaba en el momento de firmar (misma logica que firmar.js:
// el hash se calcula antes de incrustar el bloque de evidencia, no despues).
export function renderFichaHtml(ficha, cliente, emisor, opts = {}) {
  const secciones = seccionesActivas(ficha.secciones);
  let html = (opts.soloCuerpo ? '' : CSS_FICHA + cabeceraLogo(emisor)) + `
<h1>${esc(ficha.titulo || 'Ficha de implementacion del agente IA')}</h1>
<p class="sub">WhatsApp para empresas y negocios &middot; Cliente: ${esc(cliente?.nombre || '')} &middot; Version ${esc(String(ficha.version || 1))}</p>`;
  for (const seccion of secciones) html += bloqueSeccion(seccion, ficha.contenido?.[seccion.clave]);
  if (opts.conFirma) html += bloqueFirmaFicha(ficha, emisor);
  return html;
}
