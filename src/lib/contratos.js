const FORMAS_PAGO_TXT = {
  '50% al inicio, 50% a la entrega': '50% en el momento de la firma del presente documento, 50% restante a la entrega del trabajo.',
  '30% al inicio, 70% a la entrega': '30% en el momento de la firma del presente documento, 70% restante a la entrega del trabajo.',
  '100% al inicio': '100% en el momento de la firma del presente documento.',
  '100% a la entrega': '100% a la entrega del trabajo realizado.',
  'Cuota mensual recurrente': 'Cuota mensual recurrente, abonada por adelantado el primer dia de cada mes.',
};

export function fmtEuros(n) {
  return Number(n || 0).toFixed(2).replace('.', ',') + ' EUR';
}

export function fechaLarga(d) {
  const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return d.getDate() + ' de ' + m[d.getMonth()] + ' de ' + d.getFullYear();
}

function tablaServicios(servicios) {
  let html = '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11pt"><thead><tr style="background:#047857;color:#fff"><th style="padding:8px;text-align:left;border:1px solid #ddd">Servicio</th><th style="padding:8px;text-align:center;border:1px solid #ddd">Cant</th><th style="padding:8px;text-align:right;border:1px solid #ddd">Precio</th><th style="padding:8px;text-align:right;border:1px solid #ddd">Subtotal</th></tr></thead><tbody>';
  (servicios || []).forEach((s) => {
    if (!s.nombre) return;
    const sub = (parseFloat(s.cantidad) || 0) * (parseFloat(s.precio) || 0);
    html += `<tr><td style="padding:8px;border:1px solid #ddd">${s.nombre}</td><td style="padding:8px;text-align:center;border:1px solid #ddd">${s.cantidad}</td><td style="padding:8px;text-align:right;border:1px solid #ddd">${fmtEuros(s.precio)}</td><td style="padding:8px;text-align:right;border:1px solid #ddd">${fmtEuros(sub)}</td></tr>`;
  });
  return html + '</tbody></table>';
}

function cabeceraLogo(e) {
  // Orden de prioridad para encontrar el logo:
  // 1. e.logo_data_url -> dataURL base64 precargado por el frontend (mejor para PDFs)
  // 2. e.logo_url      -> URL personalizada que el usuario haya guardado en BD
  // 3. fallback        -> /logo-conecta-nex.png con URL absoluta
  let url = e.logo_data_url || e.logo_url || '';
  if (!url && typeof window !== 'undefined' && window.location) {
    url = window.location.origin + '/logo-conecta-nex.png';
  } else if (!url) {
    url = 'https://clientes.conectanex.com/logo-conecta-nex.png';
  }
  if (!url) return '';
  return `<div style="text-align:center;margin-bottom:20px"><img src="${url}" alt="Conecta Nex" crossorigin="anonymous" style="max-height:80px;max-width:300px"/></div>`;
}

function bloqueComun(c, e) {
  const f = c.fecha_creacion || c.creado_en ? new Date(c.fecha_creacion || c.creado_en) : new Date();
  const lugarFecha = 'En ' + (e.ciudad || 'Alicante') + ', a ' + fechaLarga(f);
  const dirEm = [e.direccion, e.cp, e.ciudad, e.provincia].filter(Boolean).join(', ');
  const dirCl = [c.direccion, (c.cp ? c.cp + ' ' : '') + c.ciudad, c.provincia, c.pais].filter(Boolean).join(', ');
  const tipoDoc = c.tipo_persona === 'Juridica' ? 'CIF' : 'NIF';
  const tipoFrase = c.tipo_persona === 'Juridica' ? 'sociedad mercantil con CIF' : 'mayor de edad con NIF';
  const tabla = tablaServicios(c.servicios_json || []);
  const ibanBl = e.iban ? `<p><strong>IBAN para la transferencia:</strong> ${e.iban}</p>` : '';
  const contBl = c.contacto ? `, representada por ${c.contacto}` : '';
  const descBl = c.descripcion ? `<p><strong>Descripcion del proyecto:</strong> ${c.descripcion}</p>` : '';
  const fpTxt = FORMAS_PAGO_TXT[c.forma_pago] || c.forma_pago;
  const epi = e.epigrafe ? ` (${e.epigrafe})` : '';
  return { lugarFecha, dirEm, dirCl, tipoDoc, tipoFrase, tabla, ibanBl, contBl, descBl, fpTxt, epi };
}

function bloqueFirmas(c, e, firmaImagenURL, labels) {
  const tipoDoc = c.tipo_persona === 'Juridica' ? 'CIF' : 'NIF';
  const labIzq = (labels && labels.izq) || 'El Prestador';
  const labDer = (labels && labels.der) || 'El Cliente';
  const firmaCliente = firmaImagenURL || c.firma_cliente;
  const imgFirma = firmaCliente ? `<img src="${firmaCliente}" style="max-width:200px;max-height:80px;display:block;margin:0 auto 5px"/>` : '<div style="height:60px"></div>';
  const fechaFirma = c.fecha_firma ? `<div style="font-size:9pt;color:#666;margin-top:8px">Firmado digitalmente el ${new Date(c.fecha_firma).toLocaleDateString('es-ES')}</div>` : '';
  return `
    <div style="display:flex;justify-content:space-between;margin-top:50px;gap:40px">
      <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
        <div style="height:60px"></div>
        <strong>${labIzq}</strong><br>
        ${e.nombre}<br>
        NIF: ${e.nif}
      </div>
      <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
        ${imgFirma}
        <strong>${labDer}</strong><br>
        ${c.nombre}<br>
        ${tipoDoc}: ${c.nif}
        ${fechaFirma}
      </div>
    </div>
  `;
}

const CSS_BASE = `
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; color: #047857; font-size: 18pt; margin: 10px 0 5px; }
  .sub { text-align: center; color: #666; font-size: 10pt; margin-bottom: 25px; }
  h2 { color: #047857; font-size: 13pt; margin-top: 20px; border-bottom: 1px solid #047857; padding-bottom: 3px; }
  h3 { color: #047857; font-size: 11pt; margin-top: 15px; }
  .tot { background: #f0fdf4; padding: 12px; border-left: 3px solid #047857; margin: 10px 0; }
  .tot p { margin: 4px 0; }
  .tot-final { font-size: 13pt; font-weight: bold; color: #047857; }
  p { margin: 6px 0; }
  .aviso { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px; margin: 12px 0; }
</style>
`;

export function generarHojaEncargo(c, e, firmaURL, opts = {}) {
  const b = bloqueComun(c, e);
  const t = { base: c.base_imponible, iva: c.iva_importe, total: c.total };
  return (opts.soloCuerpo ? '' : CSS_BASE + cabeceraLogo(e)) + `
<h1>HOJA DE ENCARGO</h1>
<p class="sub">N de expediente: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>1. Reunidos</h2>
<p>De una parte, <strong>${e.nombre}</strong>, con NIF ${e.nif}, con domicilio profesional en ${b.dirEm}, en su condicion de profesional autonomo dado de alta en el RETA y en el censo de empresarios del IAE, en adelante "el Prestador".</p>
<p>De otra parte, <strong>${c.nombre}</strong>, con ${b.tipoDoc} ${c.nif}, con domicilio en ${b.dirCl}${b.contBl}, en adelante "el Cliente".</p>
<p>Ambas partes se reconocen reciprocamente capacidad legal suficiente para suscribir el presente documento y, a tal efecto,</p>

<h2>2. Manifiestan</h2>
<p>I. Que el Prestador ofrece servicios profesionales de diseno web, marketing digital, identidad visual y servicios complementarios.</p>
<p>II. Que el Cliente esta interesado en contratar al Prestador para el desarrollo de los servicios que se detallan en la clausula siguiente.</p>
<p>III. Que es voluntad de ambas partes formalizar el presente encargo conforme a las clausulas que siguen.</p>

<h2>3. Objeto del encargo</h2>
${b.tabla}
${b.descBl}

<h2>4. Plazo de entrega</h2>
<p>El Prestador se compromete a entregar el trabajo en un plazo de ${c.plazo || 'a determinar'}, siempre que el Cliente facilite a tiempo los materiales, accesos e informacion necesarios. Cualquier retraso imputable al Cliente prorrogara automaticamente el plazo en igual numero de dias.</p>

<h2>5. Precio</h2>
<div class="tot"><p>Base imponible: <strong>${fmtEuros(t.base)}</strong></p><p>IVA (${c.iva}%): <strong>${fmtEuros(t.iva)}</strong></p><p class="tot-final">TOTAL: ${fmtEuros(t.total)}</p></div>

<h2>6. Forma de pago</h2>
<p>${b.fpTxt}</p>
${b.ibanBl}
<p>La falta de pago en los plazos pactados podra conllevar la suspension inmediata del trabajo.</p>

<h2>7. Alcance del trabajo y modificaciones</h2>
<p>El alcance se limita a lo descrito en el objeto. Cualquier modificacion sustancial sera presupuestada y aceptada por escrito antes de su ejecucion.</p>

<h2>8. Politica de privacidad</h2>
<p>Los datos personales del Cliente se trataran conforme al RGPD (Reglamento UE 2016/679) y a la LO 3/2018 (LOPDGDD). Responsable: ${e.nombre}, NIF ${e.nif}, ${e.email}. Finalidad: gestion contractual del encargo. Base legal: ejecucion del contrato (art. 6.1.b RGPD). Conservacion: durante la relacion y los plazos legales. El Cliente puede ejercer sus derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad en la direccion indicada, y reclamar ante la Agencia Espanola de Proteccion de Datos.</p>

<h2>9. Autorizacion de uso de datos y accesos</h2>
<p>El Cliente <strong>autoriza expresamente</strong> al Prestador a acceder, utilizar y gestionar las cuentas, accesos, credenciales, perfiles, dominios, alojamientos y datos que resulten necesarios para ejecutar el encargo (entre otros: web y hosting, correo, ficha de Google, perfiles de redes sociales y herramientas de marketing, automatizacion y CRM), de forma exclusiva para las finalidades del presente encargo y mientras dure la relacion.</p>
<p>El Cliente declara ser titular o estar legitimado para ceder dichos accesos, se compromete a facilitarlos en tiempo y forma y a comunicarlos de forma segura. El Prestador guardara confidencialidad sobre dichas credenciales, las empleara unicamente para el encargo y procedera a su devolucion o supresion a la finalizacion cuando asi lo solicite el Cliente.</p>
<p>Cuando el tratamiento implique datos personales de los que el Cliente sea responsable, se regira por el <strong>Contrato de Encargo de Tratamiento (art. 28 RGPD)</strong> que se suscribe junto a este documento y forma parte inseparable del mismo.</p>

${opts.soloCuerpo ? '' : bloqueFirmas(c, e, firmaURL)}
`;
}

export function generarCesion(c, e, firmaURL) {
  const b = bloqueComun(c, e);
  return CSS_BASE + cabeceraLogo(e) + `
<h1>CESION DE DERECHOS Y PROTECCION DE DATOS</h1>
<p class="sub">N de expediente: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>1. Materiales aportados por el Cliente</h2>
<p>El Cliente declara y garantiza que dispone de los derechos necesarios sobre todos los materiales (textos, imagenes, videos, marcas, contenidos) que entrega al Prestador para su uso en el proyecto.</p>
<p>El Cliente exime al Prestador de cualquier responsabilidad derivada del uso de dichos materiales.</p>

<h2>2. Cesion de derechos sobre el trabajo entregado</h2>
<p>Una vez abonado integramente el precio acordado, el Prestador cede al Cliente, en regimen de exclusividad y para Espana, los derechos de explotacion (reproduccion, distribucion, comunicacion publica y transformacion) sobre el trabajo final entregado, durante un plazo de DIEZ (10) anos renovables.</p>
<p>La cesion NO incluye los archivos editables intermedios, librerias de terceros, plantillas premium o licencias de software, ni elementos predisenados (iconos, fuentes, recursos graficos) sujetos a licencias especificas, salvo que se acuerde lo contrario por escrito.</p>
<p>El Prestador conserva en todo caso el derecho moral sobre su obra.</p>

<h2>3. Garantias y limitacion de responsabilidad</h2>
<p>Se ofrece un periodo de garantia de 30 dias naturales desde la entrega para corregir, sin coste adicional, defectos directamente atribuibles al Prestador.</p>
<p>Quedan EXCLUIDAS de la garantia: modificaciones realizadas por el Cliente o terceros tras la entrega; fallos derivados de servicios contratados con terceros; cambios o actualizaciones de plataformas externas; ataques informaticos o usos indebidos.</p>
<p>La responsabilidad maxima del Prestador queda limitada al importe abonado, salvo dolo o negligencia grave conforme al art. 1102 CC.</p>

<h2>4. Servicios de terceros, cookies y analitica</h2>
<p>El Cliente es el unico responsable de cumplir con la normativa aplicable a servicios de terceros integrados (Google Analytics, Meta Pixel, plugins, etc.), especialmente en materia de cookies (Directiva 2002/58/CE) e informacion al usuario.</p>

<h2>5. Confidencialidad</h2>
<p>Ambas partes se obligan a guardar confidencialidad sobre la informacion intercambiada durante un periodo de dos (2) anos desde la finalizacion del encargo.</p>

<h2>6. Tratamiento de datos personales</h2>
<p>Si el desarrollo del servicio implica acceso del Prestador a datos personales de los que el Cliente sea responsable, las partes suscribiran el Contrato de Encargado de Tratamiento conforme al articulo 28 RGPD.</p>
<p>Finalizado el proyecto, el Prestador devolvera o suprimira los datos personales, salvo aquellos que deba conservar por imperativo legal.</p>

<h2>7. Aceptacion</h2>
<p>Las partes manifiestan haber leido y comprendido el presente documento, aceptando todas y cada una de sus clausulas.</p>

${bloqueFirmas(c, e, firmaURL)}
`;
}

export function generarContrato(c, e, firmaURL, opts = {}) {
  const b = bloqueComun(c, e);
  const t = { base: c.base_imponible, iva: c.iva_importe, total: c.total };
  const esConsumidor = c.tipo_persona === 'Fisica';
  return (opts.soloCuerpo ? '' : CSS_BASE + cabeceraLogo(e)) + `
<h1>CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES</h1>
<p class="sub">N de contrato: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>REUNIDOS</h2>
<p>De una parte, <strong>${e.nombre}</strong>, mayor de edad, con NIF ${e.nif} y domicilio profesional en ${b.dirEm}, profesional autonomo dado de alta en el RETA y en el censo del IAE${b.epi}, en adelante "el Profesional".</p>
<p>De otra parte, <strong>${c.nombre}</strong>, ${b.tipoFrase} ${c.nif}, con domicilio en ${b.dirCl}${b.contBl}, en adelante "el Cliente".</p>

<h2>EXPONEN</h2>
<p>I. Que el Profesional desarrolla actividad economica en el ambito del diseno web, marketing digital y servicios afines.</p>
<p>II. Que el Cliente desea contratar los servicios profesionales del Profesional.</p>
<p>III. Que ambas partes han alcanzado un acuerdo sobre el alcance, plazo, precio y condiciones de la prestacion.</p>

<h2>CLAUSULAS</h2>

<h3>Primera. Objeto</h3>
<p>El Profesional prestara al Cliente, en regimen de arrendamiento de servicios profesionales (art. 1544 CC), los siguientes servicios:</p>
${b.tabla}
${b.descBl}
<p>La relacion entre las partes es estrictamente mercantil y profesional, no existiendo vinculo laboral, de exclusividad ni subordinacion.</p>

<h3>Segunda. Duracion</h3>
<p>Vigor en la fecha de firma. Plazo previsto de ejecucion: ${c.plazo || 'a determinar'}. Cualquier prorroga debera acordarse por escrito.</p>

<h3>Tercera. Precio y forma de pago</h3>
<div class="tot"><p>Base imponible: <strong>${fmtEuros(t.base)}</strong></p><p>IVA (${c.iva}%): <strong>${fmtEuros(t.iva)}</strong></p><p class="tot-final">TOTAL: ${fmtEuros(t.total)}</p></div>
<p>Forma de pago: ${b.fpTxt}</p>
${b.ibanBl}

<h3>Cuarta. Gastos a terceros</h3>
<p>Cuando el servicio incluya campanas publicitarias en plataformas de terceros, el coste de la inversion publicitaria es independiente del precio acordado y sera abonado directamente por el Cliente al proveedor. Igual aplica a hosting, dominios, plugins premium y licencias de software.</p>

<h3>Quinta. Obligaciones del Cliente</h3>
<p>Facilitar materiales, accesos y contrasenas en tiempo y forma; revisar entregas en plazos pactados; abonar puntualmente; garantizar la titularidad sobre los materiales aportados.</p>

<h3>Sexta. Obligaciones del Profesional</h3>
<p>Prestar el servicio con la diligencia profesional exigible (art. 1104 CC); cumplir el plazo de entrega salvo causas justificadas; mantener informado al Cliente; guardar confidencialidad.</p>

<h3>Septima. Entrega y aceptacion</h3>
<p>El Cliente dispondra de SIETE (7) dias naturales desde la entrega para revisar y notificar por escrito cualquier observacion. Para clientes consumidores, el plazo se amplia a CATORCE (14) dias naturales conforme al art. 102 RDL 1/2007.</p>

<h3>Octava. Propiedad intelectual y cesion de derechos</h3>
<p>Los terminos de cesion se rigen por el documento "Cesion de Derechos y Proteccion de Datos" anexo, que forma parte integrante e inseparable del presente.</p>

<h3>Novena. Confidencialidad y no captacion</h3>
<p>Confidencialidad reciproca durante la vigencia y por DOS (2) anos tras su finalizacion. Las partes se obligan a no captar empleados, colaboradores o subcontratistas de la otra parte durante la vigencia del contrato y un (1) ano posterior.</p>

<h3>Decima. Proteccion de datos</h3>
<p>Conforme al RGPD y LOPDGDD. Responsable del tratamiento: ${e.nombre}, NIF ${e.nif}. Contacto: ${e.email}. Si el servicio implica acceso a datos personales del Cliente, las partes suscribiran el correspondiente Contrato de Encargado de Tratamiento (art. 28 RGPD).</p>

<h3>Undecima. Inteligencia Artificial</h3>
<p>El Profesional informa que en la prestacion de algunos servicios podra utilizar herramientas de Inteligencia Artificial conforme al Reglamento (UE) 2024/1689. El uso de IA se hara siempre bajo supervision humana. El Cliente podra solicitar la no utilizacion de IA en su proyecto.</p>

<h3>Duodecima. Resolucion</h3>
<p>Resoluble por mutuo acuerdo, por incumplimiento grave (art. 1124 CC, previa notificacion para subsanar) o por las causas legalmente previstas. En caso de resolucion imputable al Cliente, el Profesional tendra derecho al cobro del trabajo efectivamente realizado.</p>

<h3>Decimotercera. Limitacion de responsabilidad</h3>
<p>La responsabilidad del Profesional queda limitada al importe efectivamente abonado por el Cliente, salvo en caso de dolo o negligencia grave (art. 1102 CC). No respondera por danos indirectos, lucro cesante, perdida de datos ni fallos atribuibles a servicios de terceros.</p>

<h3>Decimocuarta. Notificaciones</h3>
<p>Las notificaciones se realizaran por correo electronico: Profesional: ${e.email}. Cliente: ${c.email || '________________'}.</p>

<h3>Decimoquinta. Subsistencia</h3>
<p>Si alguna clausula fuera declarada nula, ello no afectara a la validez del resto del contrato.</p>

<h3>Decimosexta. Legislacion y jurisdiccion</h3>
<p>El presente contrato se rige por la legislacion espanola. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de ${e.ciudad}, con renuncia expresa a su propio fuero. ${esConsumidor ? 'No obstante, cuando el Cliente tenga la consideracion de consumidor conforme al RDL 1/2007, sera competente el Juzgado del domicilio del consumidor.' : ''}</p>

<p>Y en prueba de conformidad, ambas partes firman el presente contrato por duplicado y a un solo efecto.</p>

${opts.soloCuerpo ? '' : bloqueFirmas(c, e, firmaURL)}
`;
}

// Contrato de Encargo de Tratamiento (art. 28 RGPD). OJO: aqui los roles se
// invierten -> el Cliente es el RESPONSABLE y el Prestador (agencia) el ENCARGADO.
export function generarEncargoTratamiento(c, e, firmaURL, opts = {}) {
  const b = bloqueComun(c, e);
  return (opts.soloCuerpo ? '' : CSS_BASE + cabeceraLogo(e)) + `
<h1>CONTRATO DE ENCARGO DE TRATAMIENTO DE DATOS</h1>
<p class="sub">Conforme al art. 28 del Reglamento (UE) 2016/679 (RGPD) y a la LO 3/2018 (LOPDGDD)<br>N de expediente: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>Reunidos</h2>
<p>De una parte, <strong>${c.nombre}</strong>, con ${b.tipoDoc} ${c.nif} y domicilio en ${b.dirCl}${b.contBl}, en adelante "el Responsable del Tratamiento".</p>
<p>De otra parte, <strong>${e.nombre}</strong>, con NIF ${e.nif} y domicilio profesional en ${b.dirEm}, profesional autonomo, en adelante "el Encargado del Tratamiento".</p>

<h2>1. Objeto</h2>
<p>El presente contrato regula el tratamiento de datos personales que el Encargado realiza por cuenta del Responsable como consecuencia de la prestacion de los servicios contratados (en adelante, "el Servicio"), conforme al art. 28 RGPD. Solo se autoriza a tratar los datos para prestar el Servicio.</p>

<h2>2. Identificacion del tratamiento</h2>
<p><strong>Finalidad:</strong> ejecutar los servicios encargados (diseno y mantenimiento web, marketing digital, gestion de redes y perfiles, automatizaciones e inteligencia artificial y servicios afines).</p>
<p><strong>Naturaleza y operaciones:</strong> recogida, registro, consulta, conservacion, modificacion, comunicacion cuando proceda y supresion de datos en las plataformas y cuentas del Responsable.</p>
<p><strong>Tipos de datos:</strong> identificativos y de contacto (nombre, email, telefono) y datos de clientes, contactos o usuarios del Responsable contenidos en sus plataformas. No se trataran categorias especiales de datos (art. 9 RGPD) salvo instruccion expresa y por escrito del Responsable.</p>
<p><strong>Categorias de interesados:</strong> clientes, contactos, leads y usuarios del Responsable.</p>
<p><strong>Duracion:</strong> la del contrato de prestacion de servicios. Finalizado este, se estara a lo previsto en la clausula 3.g).</p>

<h2>3. Obligaciones del Encargado (art. 28.3 RGPD)</h2>
<p>a) Tratar los datos unicamente siguiendo instrucciones documentadas del Responsable, incluidas las transferencias internacionales; si debiera tratarlos por imperativo legal, informara previamente al Responsable salvo prohibicion.</p>
<p>b) Garantizar que las personas autorizadas para tratar los datos se comprometen a respetar la confidencialidad (arts. 28.3.b y 29 RGPD).</p>
<p>c) Aplicar las medidas tecnicas y organizativas apropiadas para garantizar la seguridad del tratamiento (art. 32 RGPD): control de accesos, gestion segura de credenciales, cifrado cuando proceda, copias de seguridad y minimizacion de datos.</p>
<p>d) No recurrir a otro encargado (subencargado) sin autorizacion previa del Responsable; los subencargados quedaran sujetos a las mismas obligaciones (arts. 28.2 y 28.4 RGPD). Se entienden autorizados con caracter general los proveedores tecnologicos necesarios para el Servicio (alojamiento, plataformas de IA y marketing, herramientas de automatizacion), velando el Encargado por que cumplan el RGPD.</p>
<p>e) Asistir al Responsable para atender el ejercicio de derechos de los interesados (acceso, rectificacion, supresion, oposicion, limitacion y portabilidad) y para cumplir las obligaciones de los arts. 32 a 36 RGPD.</p>
<p>f) Notificar al Responsable, sin dilacion indebida, las violaciones de seguridad de los datos de las que tenga conocimiento, con la informacion relevante para su gestion.</p>
<p>g) A eleccion del Responsable, suprimir o devolver todos los datos personales una vez finalice la prestacion, y suprimir las copias existentes, salvo que deba conservarlos por imperativo legal (art. 28.3.g RGPD).</p>
<p>h) Poner a disposicion del Responsable la informacion necesaria para demostrar el cumplimiento de estas obligaciones y permitir y contribuir a auditorias razonables (art. 28.3.h RGPD).</p>

<h2>4. Obligaciones del Responsable</h2>
<p>Entregar al Encargado los datos y accesos necesarios; impartir y documentar las instrucciones de tratamiento; garantizar la licitud y la base juridica del tratamiento; y haber informado a los interesados conforme a los arts. 13 y 14 RGPD.</p>

<h2>5. Responsabilidad y legislacion aplicable</h2>
<p>Cada parte respondera de los danos y perjuicios que cause por el incumplimiento de sus obligaciones (art. 82 RGPD). El presente contrato se rige por el RGPD, la LO 3/2018 (LOPDGDD) y demas normativa espanola y de la Union Europea aplicable. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de ${e.ciudad || 'Alicante'}.</p>

<h2>6. Aceptacion</h2>
<p>Las partes declaran haber leido y aceptan integramente el presente Contrato de Encargo de Tratamiento, que forma parte inseparable del contrato de prestacion de servicios suscrito entre ellas.</p>

${opts.soloCuerpo ? '' : bloqueFirmas(c, e, firmaURL, { izq: 'El Encargado (Prestador)', der: 'El Responsable (Cliente)' })}
`;
}

// NUEVO: Acta de Entrega y Acceso a Recursos
// Genera el documento que se entrega al cliente al finalizar el proyecto.
// Incluye resumen, accesos, archivos entregados y firmas.
// Censura una contrasena dejando solo los ultimos 4 caracteres visibles.
// Ejemplo: "miPassw0rd123" -> "*********1234"
function censurarPassword(pwd) {
  if (!pwd) return '';
  if (pwd.length <= 4) return '*'.repeat(pwd.length);
  return '*'.repeat(pwd.length - 4) + pwd.slice(-4);
}

// Generar Acta de Entrega.
// modo='borrador' (durante el proyecto, contraseñas en claro, sin QR)
// modo='definitiva' (al firmar, contraseñas censuradas, con QR + codigo + PIN info)
//
// extras puede incluir:
//   accesos: array de credenciales del cliente
//   archivos: array de archivos del cliente
//   entregables: array de items entregados (para mostrar lo que se entrega)
//   modo: 'borrador' | 'definitiva'
//   qr_dataurl: imagen base64 del codigo QR (solo en definitiva)
//   url_acceso: URL del QR para mostrar como texto debajo
//   codigo_aceptacion: codigo legible tipo ACT-2026-0001-ABCDE
export function generarActaEntrega(c, e, firmaURL, accesos, archivos, opciones) {
  const modo = (opciones && opciones.modo) || 'borrador';
  const qrDataURL = opciones && opciones.qr_dataurl;
  const urlAcceso = opciones && opciones.url_acceso;
  const codigoAceptacion = opciones && opciones.codigo_aceptacion;
  const entregables = opciones && opciones.entregables;
  const branding = (opciones && opciones.branding) || {};
  const imagenesDataURL = (opciones && Array.isArray(opciones.imagenes_dataurl)) ? opciones.imagenes_dataurl : [];

  const b = bloqueComun(c, e);
  const lista = (Array.isArray(accesos) ? accesos : []).filter(a => a && a.etiqueta);
  const archs = Array.isArray(archivos) ? archivos : [];

  // Agrupacion por categoria
  const grupos = lista.reduce((acc, a) => {
    const k = a.categoria || 'Otros';
    if (!acc[k]) acc[k] = [];
    acc[k].push(a);
    return acc;
  }, {});

  const seccionesAccesos = Object.keys(grupos).sort().map((cat) => {
    const filas = grupos[cat].map((a) => {
      const url = a.url ? `<a href="${a.url}" style="color:#047857">${a.url}</a>` : '-';
      const usu = a.usuario || '-';
      let pwd;
      if (modo === 'definitiva') {
        // En modo definitiva censuramos las contraseñas
        pwd = a.password
          ? censurarPassword(a.password)
          : (a.tiene_password ? censurarPassword('xxxxxxxxxxxx') : '-');
      } else {
        pwd = a.password ? a.password : (a.tiene_password ? '(consultar)' : '-');
      }
      const notas = a.notas ? `<div style="font-size:9pt;color:#666;margin-top:3px">${a.notas}</div>` : '';
      return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">${a.etiqueta}${notas}</td><td style="padding:8px;border:1px solid #ddd;font-size:10pt">${url}</td><td style="padding:8px;border:1px solid #ddd;font-size:10pt">${usu}</td><td style="padding:8px;border:1px solid #ddd;font-size:10pt;font-family:monospace">${pwd}</td></tr>`;
    }).join('');
    return `
      <h3>${cat}</h3>
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt">
        <thead><tr style="background:#047857;color:#fff">
          <th style="padding:8px;text-align:left;border:1px solid #ddd">Plataforma</th>
          <th style="padding:8px;text-align:left;border:1px solid #ddd">URL</th>
          <th style="padding:8px;text-align:left;border:1px solid #ddd">Usuario</th>
          <th style="padding:8px;text-align:left;border:1px solid #ddd">Contrasena</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }).join('');

  // Seccion de entregables (si existen)
  let seccionEntregables = '';
  if (Array.isArray(entregables) && entregables.length > 0) {
    const filas = entregables.map(en => {
      const check = en.completado ? '✓' : '·';
      const fecha = en.fecha_completado ? new Date(en.fecha_completado).toLocaleDateString('es-ES') : '-';
      const estilo = en.completado
        ? 'background: #f0fdf4; border-left: 3px solid #047857;'
        : 'background: #fafafa; border-left: 3px solid #d1d5db;';
      return `<tr><td style="padding: 6px 10px; ${estilo}; font-weight: 600;">${check} ${en.nombre}</td><td style="padding: 6px 10px; ${estilo}; font-size: 10pt; color: #666;">${en.completado ? 'Entregado el ' + fecha : 'Pendiente'}</td></tr>`;
    }).join('');
    seccionEntregables = `
      <h2>Entregables del proyecto</h2>
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11pt">
        ${filas}
      </table>
    `;
  }

  const seccionArchivos = archs.length > 0 ? `
    <h2>Archivos entregados</h2>
    <ul>${archs.map(a => `<li>${a.nombre} (${(a.tamano / 1024).toFixed(1)} KB)</li>`).join('')}</ul>
  ` : '';

  const totalServ = (c.servicios_json || []).filter(s => s.nombre).map(s => s.nombre).join(', ') || c.descripcion || 'Servicios contratados';

  // Bloque de QR + codigo de aceptacion (solo en modo definitiva)
  let bloqueQR = '';
  if (modo === 'definitiva' && qrDataURL) {
    bloqueQR = `
      <div style="margin: 30px 0; padding: 20px; background: #f0fdf4; border: 1px solid #047857; border-radius: 8px; display: flex; align-items: center; gap: 20px;">
        <img src="${qrDataURL}" alt="Codigo QR de acceso" style="width: 140px; height: 140px; border: 1px solid #ccc; padding: 5px; background: white;" />
        <div style="flex: 1; font-size: 11pt;">
          <strong style="color: #047857; font-size: 13pt;">Acceso seguro a tus contraseñas</strong>
          <p style="margin: 6px 0;">Las contraseñas de este documento estan censuradas por seguridad. Para verlas completas:</p>
          <ol style="padding-left: 20px; margin: 6px 0;">
            <li>Escanea este codigo QR con tu movil.</li>
            <li>Introduce el PIN de 5 digitos que te enviamos por email.</li>
            <li>Veras todas tus contraseñas completas en una pagina segura.</li>
          </ol>
          <p style="margin: 8px 0 0; font-size: 9pt; color: #666; word-break: break-all;">${urlAcceso || ''}</p>
        </div>
      </div>
    `;
  }

  const bloqueCodigoAceptacion = (modo === 'definitiva' && codigoAceptacion)
    ? `<div style="margin: 20px 0; padding: 12px; background: #fafafa; border: 1px dashed #999; text-align: center; font-family: monospace; font-size: 11pt;">
         Codigo de aceptacion: <strong>${codigoAceptacion}</strong>
       </div>`
    : '';

  const aviso = modo === 'definitiva'
    ? `<div class="aviso">
        <strong>IMPORTANTE - Seguridad de tus contraseñas:</strong> Las contraseñas de este documento aparecen censuradas. Para verlas completas, escanea el codigo QR de arriba e introduce el PIN que recibiste por email. Tras la primera consulta te recomendamos cambiar las contraseñas, asumiendo desde ese momento la unica responsabilidad sobre su custodia. El Prestador queda eximido de cualquier responsabilidad por accesos posteriores.
      </div>`
    : `<div class="aviso">
        <strong>BORRADOR - Documento de uso interno:</strong> Este es un borrador del acta para revision interna del prestador. Las contraseñas aparecen en claro porque no se ha generado todavia la version firmada. La version definitiva mostrara las contraseñas censuradas y un codigo QR de acceso seguro.
      </div>`;

  const tituloDoc = modo === 'definitiva'
    ? 'ACTA DE ENTREGA Y ACCESO A RECURSOS'
    : 'ACTA DE ENTREGA - BORRADOR';

  // Bloque "Identidad de marca y materiales entregados"
  // Aparece en el Acta para que el cliente tenga un dossier independiente
  // de los archivos digitales que se le hayan entregado.
  let bloqueMarca = '';
  const tagline = (branding.tagline || '').trim();
  const colores = Array.isArray(branding.colores) ? branding.colores.filter(x => x && x.hex) : [];
  const tipografias = Array.isArray(branding.tipografias) ? branding.tipografias.filter(x => x && x.nombre) : [];

  const tieneAlgo = tagline || colores.length > 0 || tipografias.length > 0 || imagenesDataURL.length > 0;
  if (tieneAlgo) {
    let html = '<h2>Identidad de marca y materiales entregados</h2>';

    if (tagline) {
      html += `<div style="margin: 12px 0; padding: 14px 18px; background: #f0fdf4; border-left: 4px solid #047857; font-style: italic; font-size: 13pt; color: #064e3b;">"${tagline}"</div>`;
    }

    if (colores.length > 0) {
      html += '<h3>Paleta de colores corporativos</h3>';
      html += '<div style="display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0;">';
      colores.forEach(col => {
        const hex = col.hex || '#000';
        const nombre = col.nombre || hex;
        const uso = col.uso ? `<div style="font-size: 9pt; color: #666; margin-top: 2px;">${col.uso}</div>` : '';
        html += `
          <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; width: 150px;">
            <div style="background: ${hex}; height: 70px;"></div>
            <div style="padding: 8px;">
              <strong style="font-size: 10pt;">${nombre}</strong>
              <div style="font-family: monospace; font-size: 10pt; color: #444;">${hex}</div>
              ${uso}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    if (tipografias.length > 0) {
      html += '<h3>Tipografias</h3>';
      html += '<ul style="font-size: 11pt;">';
      tipografias.forEach(tp => {
        const uso = tp.uso ? ` <span style="color: #666;">- ${tp.uso}</span>` : '';
        html += `<li><strong>${tp.nombre}</strong>${uso}</li>`;
      });
      html += '</ul>';
    }

    if (imagenesDataURL.length > 0) {
      html += '<h3>Materiales graficos entregados</h3>';
      html += '<ul style="font-size: 11pt; line-height: 1.6;">';
      imagenesDataURL.forEach(img => {
        const nombre = img.nombre || 'Archivo';
        const tam = img.tamano ? ` <span style="color: #666; font-size: 10pt;">(${(img.tamano / 1024).toFixed(0)} KB)</span>` : '';
        html += `<li>${nombre}${tam}</li>`;
      });
      html += '</ul>';
      html += '<p style="font-size: 10pt; color: #666; font-style: italic;">Estos materiales se entregan al cliente en formato digital aparte de este documento.</p>';
    }

    bloqueMarca = html;
  }

  return CSS_BASE + cabeceraLogo(e) + `
<h1>${tituloDoc}</h1>
<p class="sub">N de contrato: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>1. Reunidos</h2>
<p>De una parte, <strong>${e.nombre}</strong>, con NIF ${e.nif}, profesional autonomo, en adelante "el Prestador".</p>
<p>De otra parte, <strong>${c.nombre}</strong>, con ${b.tipoDoc} ${c.nif}, en adelante "el Cliente".</p>

<h2>2. Objeto de la entrega</h2>
<p>Mediante el presente documento se formaliza la entrega al Cliente del trabajo realizado en el marco del contrato de prestacion de servicios firmado entre las partes.</p>
<p><strong>Servicios entregados:</strong> ${totalServ}.</p>
${b.descBl}

${seccionEntregables}

${bloqueMarca}

<h2>3. Accesos y credenciales entregados</h2>
${lista.length === 0 ? '<p>No se entregan credenciales en este proyecto.</p>' : seccionesAccesos}

${bloqueQR}

${aviso}

${seccionArchivos}

<h2>4. Conformidad y aceptacion</h2>
<p>Con la firma del presente documento, el Cliente reconoce haber recibido el trabajo descrito y los accesos relacionados, considerandose entregado el proyecto a todos los efectos.</p>
<p>Conforme a la clausula septima del contrato, el Cliente dispondra de un plazo de SIETE (7) dias naturales desde la presente fecha para notificar por escrito cualquier observacion. Para clientes consumidores el plazo se amplia a CATORCE (14) dias.</p>

<h2>5. Periodo de garantia</h2>
<p>Se mantiene el periodo de garantia de 30 dias naturales para la correccion de defectos directamente atribuibles al Prestador, segun lo establecido en el contrato firmado.</p>

${bloqueCodigoAceptacion}

${bloqueFirmas(c, e, firmaURL)}
`;
}

// Paquete completo: Hoja de Encargo + Encargo de Tratamiento (art. 28) + Contrato,
// en un solo documento con UNA firma (con los datos del cliente y del emisor).
export function generarPaqueteContratos(c, e, firmaURL) {
  const sep = '<div style="page-break-before:always;border-top:2px solid #047857;margin:34px 0 0;padding-top:6px"></div>';
  const nota = `<p style="margin-top:26px;font-size:10pt;color:#444"><strong>Firma conjunta:</strong> con una sola firma el Cliente declara haber leido y aceptar integramente los tres documentos anteriores (Hoja de Encargo, Contrato de Encargo de Tratamiento y Contrato de Prestacion de Servicios), que forman un todo inseparable.</p>`;
  return CSS_BASE + cabeceraLogo(e)
    + generarHojaEncargo(c, e, '', { soloCuerpo: true })
    + sep + generarEncargoTratamiento(c, e, '', { soloCuerpo: true })
    + sep + generarContrato(c, e, '', { soloCuerpo: true })
    + nota + bloqueFirmas(c, e, firmaURL);
}

export function generarPorTipo(tipo, cliente, emisor, firmaURL, extras) {
  if (tipo === 'hoja') return generarHojaEncargo(cliente, emisor, firmaURL);
  if (tipo === 'cesion') return generarCesion(cliente, emisor, firmaURL);
  if (tipo === 'encargo_tratamiento') return generarEncargoTratamiento(cliente, emisor, firmaURL);
  if (tipo === 'paquete') return generarPaqueteContratos(cliente, emisor, firmaURL);
  if (tipo === 'contrato') return generarContrato(cliente, emisor, firmaURL);
  if (tipo === 'acta') {
    return generarActaEntrega(
      cliente, emisor, firmaURL,
      extras?.accesos,
      extras?.archivos,
      {
        modo: extras?.modo || 'borrador',
        qr_dataurl: extras?.qr_dataurl,
        url_acceso: extras?.url_acceso,
        codigo_aceptacion: extras?.codigo_aceptacion,
        entregables: extras?.entregables,
        branding: extras?.branding,
        imagenes_dataurl: extras?.imagenes_dataurl,
      }
    );
  }
  return '';
}

export const TIPOS_DOC = [
  { id: 'paquete', nombre: 'Contrato completo (Hoja + RGPD + Servicios)' },
  { id: 'hoja', nombre: 'Hoja de Encargo' },
  { id: 'cesion', nombre: 'Cesion de Derechos y Proteccion de Datos' },
  { id: 'encargo_tratamiento', nombre: 'Encargo de Tratamiento (art. 28 RGPD)' },
  { id: 'contrato', nombre: 'Contrato de Prestacion de Servicios' },
  { id: 'acta', nombre: 'Acta de Entrega' },
];
