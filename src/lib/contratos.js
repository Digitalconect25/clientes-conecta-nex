// Generador de HTML para los 3 documentos legales
// Devuelve un string HTML que se renderiza en pantalla y se exporta a PDF

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

function bloqueFirmas(c, e, firmaImagenURL) {
  const tipoDoc = c.tipo_persona === 'Juridica' ? 'CIF' : 'NIF';
  const firmaCliente = firmaImagenURL || c.firma_cliente;
  const imgFirma = firmaCliente ? `<img src="${firmaCliente}" style="max-width:200px;max-height:80px;display:block;margin:0 auto 5px"/>` : '<div style="height:60px"></div>';
  const fechaFirma = c.fecha_firma ? `<div style="font-size:9pt;color:#666;margin-top:8px">Firmado digitalmente el ${new Date(c.fecha_firma).toLocaleDateString('es-ES')}</div>` : '';
  return `
    <div style="display:flex;justify-content:space-between;margin-top:50px;gap:40px">
      <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
        <div style="height:60px"></div>
        <strong>El Prestador</strong><br>
        ${e.nombre}<br>
        NIF: ${e.nif}
      </div>
      <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:8px">
        ${imgFirma}
        <strong>El Cliente</strong><br>
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
</style>
`;

export function generarHojaEncargo(c, e, firmaURL) {
  const b = bloqueComun(c, e);
  const t = { base: c.base_imponible, iva: c.iva_importe, total: c.total };
  return CSS_BASE + `
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
<p>Los precios se expresan en euros. El Prestador, en su condicion de autonomo, emitira la correspondiente factura conforme a la normativa fiscal vigente.</p>

<h2>6. Forma de pago</h2>
<p>${b.fpTxt}</p>
${b.ibanBl}
<p>La falta de pago en los plazos pactados podra conllevar la suspension inmediata del trabajo y devengara el interes legal del dinero hasta su completo abono.</p>

<h2>7. Alcance del trabajo y modificaciones</h2>
<p>El alcance del trabajo se cine a lo descrito en la clausula 3. Cualquier ampliacion, modificacion sustancial o trabajo adicional solicitado por el Cliente fuera del alcance inicial debera presupuestarse de forma separada y aceptarse por escrito antes de su ejecucion.</p>
<p>Se incluyen hasta dos rondas de revisiones razonables sobre el trabajo entregado. Las revisiones adicionales se facturaran a 30 EUR/hora.</p>

<h2>8. Entrega y conformidad</h2>
<p>El Prestador entregara el trabajo por los medios acordados. El Cliente dispondra de un plazo de 7 dias naturales desde la entrega para revisar el trabajo y comunicar por escrito cualquier reclamacion. Transcurrido dicho plazo sin manifestacion expresa, se entendera aceptado de forma tacita.</p>

<h2>9. Politica de Privacidad y Proteccion de Datos</h2>
<p>En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y de la Ley Organica 3/2018 (LOPDGDD), se informa al Cliente:</p>
<p><strong>Responsable del tratamiento:</strong> ${e.nombre}, NIF ${e.nif}, con domicilio en ${b.dirEm}.</p>
<p><strong>Datos de contacto:</strong> ${e.email} - ${e.telefono}.</p>
<p><strong>Finalidad:</strong> gestionar la relacion contractual derivada del presente encargo, prestar el servicio contratado, emitir la facturacion correspondiente y cumplir con las obligaciones legales aplicables al Prestador.</p>
<p><strong>Categorias de datos:</strong> identificativos (nombre, NIF, direccion, correo, telefono) y economicos derivados de la facturacion.</p>
<p><strong>Base juridica:</strong> ejecucion de un contrato (art. 6.1.b RGPD) y cumplimiento de obligaciones legales del responsable (art. 6.1.c RGPD).</p>
<p><strong>Destinatarios:</strong> los datos no se cederan a terceros salvo obligacion legal o cuando resulte necesario para encargados de tratamiento estrictamente vinculados a la prestacion del servicio (gestoria, hosting), siempre con las garantias exigidas por la normativa.</p>
<p><strong>Plazo de conservacion:</strong> durante la vigencia de la relacion contractual y, posteriormente, durante los plazos legalmente exigibles (minimo 6 anos para obligaciones fiscales y contables).</p>
<p><strong>Derechos del interesado:</strong> el Cliente podra ejercer los derechos de acceso, rectificacion, supresion, oposicion, limitacion del tratamiento y portabilidad escribiendo a ${e.email}, acompanando copia de su DNI. Asimismo, podra presentar reclamacion ante la Agencia Espanola de Proteccion de Datos (www.aepd.es).</p>
<p>El Cliente declara haber sido informado de los anteriores extremos y consiente expresamente el tratamiento de sus datos personales para las finalidades descritas.</p>

<h2>10. Aceptacion</h2>
<p>Ambas partes, tras leer el presente documento, manifiestan su conformidad con todas y cada una de las clausulas y lo firman en senal de aceptacion.</p>

${bloqueFirmas(c, e, firmaURL)}
`;
}

export function generarCesion(c, e, firmaURL) {
  const b = bloqueComun(c, e);
  return CSS_BASE + `
<h1>CESION DE DERECHOS Y PROTECCION DE DATOS</h1>
<p class="sub">Anexo a la Hoja de Encargo n: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>Partes</h2>
<p><strong>Prestador:</strong> ${e.nombre}, NIF ${e.nif}.<br>
<strong>Cliente:</strong> ${c.nombre}, ${b.tipoDoc} ${c.nif}.</p>

<h2>1. Objeto del presente documento</h2>
<p>El presente documento desarrolla y complementa la Hoja de Encargo firmada entre las partes, regulando de forma especifica los materiales aportados por el Cliente, la cesion de derechos sobre el trabajo entregado, las garantias y limitaciones de responsabilidad, los servicios de terceros, la confidencialidad y el tratamiento detallado de datos personales.</p>

<h2>2. Materiales aportados por el Cliente</h2>
<p>El Cliente declara y garantiza que todos los materiales (textos, imagenes, videos, logotipos, marcas, bases de datos y cualquier otro contenido) que entregue al Prestador para su uso en el proyecto son de su titularidad o cuenta con licencia o autorizacion expresa para su utilizacion.</p>
<p>El Cliente exime al Prestador de cualquier responsabilidad derivada del uso de dichos materiales, asumiendo personalmente las consecuencias legales, economicas o de cualquier otra naturaleza que pudieran derivarse de un eventual uso indebido o sin autorizacion.</p>

<h2>3. Cesion de derechos sobre el trabajo entregado</h2>
<p>Una vez abonado integramente el precio acordado en la Hoja de Encargo, el Prestador cede al Cliente, en regimen de exclusividad y para todo el mundo, los derechos de explotacion (reproduccion, distribucion, comunicacion publica y transformacion) sobre el trabajo final entregado, durante el plazo maximo permitido por la legislacion vigente.</p>
<p>La cesion NO incluye los archivos editables intermedios, librerias de terceros, plantillas premium o licencias de software, ni elementos predisenados (iconos, fuentes, recursos graficos) sujetos a licencias especificas, salvo que se acuerde lo contrario por escrito.</p>
<p>El Prestador conserva en todo caso el derecho moral sobre su obra y se reserva el derecho a incluir el trabajo realizado en su porfolio profesional con fines de promocion, salvo manifestacion expresa en contrario por parte del Cliente.</p>

<h2>4. Garantias y limitacion de responsabilidad</h2>
<p>El Prestador entrega el trabajo en estado de funcionamiento conforme al alcance descrito en la Hoja de Encargo. Se ofrece un periodo de garantia de 30 dias naturales desde la entrega para corregir, sin coste adicional, defectos directamente atribuibles al Prestador.</p>
<p>Quedan EXCLUIDAS de la garantia: (a) modificaciones realizadas por el Cliente o por terceros tras la entrega; (b) caidas, errores o fallos derivados de servicios contratados con terceros (hosting, dominios, pasarelas de pago, herramientas externas, APIs); (c) cambios o actualizaciones de plataformas externas posteriores a la entrega; (d) ataques informaticos o usos indebidos del sistema entregado.</p>
<p>La responsabilidad maxima del Prestador queda limitada al importe efectivamente abonado por el Cliente.</p>

<h2>5. Servicios de terceros, cookies y analitica</h2>
<p>El Cliente entiende y acepta que el trabajo entregado puede integrar servicios de terceros (Google Analytics, Meta Pixel, herramientas de email marketing, pasarelas de pago, plugins, etc.). El Cliente es el unico responsable de cumplir con la normativa aplicable a dichos servicios, especialmente en materia de cookies, informacion al usuario y obtencion de consentimiento cuando sea exigible.</p>

<h2>6. Confidencialidad</h2>
<p>Ambas partes se obligan a guardar la mas estricta confidencialidad sobre la informacion, datos y documentacion a la que tengan acceso con motivo del presente encargo, durante un periodo de dos (2) anos desde la finalizacion del encargo.</p>

<h2>7. Proteccion de datos personales</h2>
<p>Si el desarrollo del servicio implica el acceso del Prestador a datos personales de los que el Cliente sea responsable, las partes suscribiran el correspondiente Contrato de Encargado de Tratamiento conforme al articulo 28 RGPD.</p>
<p>Finalizado el proyecto, el Prestador devolvera o suprimira, a eleccion del Cliente, todos los datos personales del Cliente o de terceros a los que haya tenido acceso, salvo aquellos que deba conservar por imperativo legal.</p>
<p>El Cliente CEDE expresamente al Prestador los datos personales necesarios para la ejecucion del encargo: identificacion y comunicacion durante el proyecto, emision de facturas, y inclusion del Cliente como referencia en el porfolio del Prestador (salvo oposicion expresa).</p>

<h2>8. Aceptacion</h2>
<p>Las partes manifiestan haber leido y comprendido el presente documento, aceptando todas y cada una de sus clausulas.</p>

${bloqueFirmas(c, e, firmaURL)}
`;
}

export function generarContrato(c, e, firmaURL) {
  const b = bloqueComun(c, e);
  const t = { base: c.base_imponible, iva: c.iva_importe, total: c.total };
  return CSS_BASE + `
<h1>CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES</h1>
<p class="sub">N de contrato: ${c.numero_contrato || c.numero_cliente}<br>${b.lugarFecha}</p>

<h2>REUNIDOS</h2>
<p>De una parte, <strong>${e.nombre}</strong>, mayor de edad, con NIF ${e.nif} y domicilio profesional en ${b.dirEm}, profesional autonomo dado de alta en el RETA y en el censo del IAE en el correspondiente epigrafe${b.epi}, en adelante "el Profesional".</p>
<p>De otra parte, <strong>${c.nombre}</strong>, ${b.tipoFrase} ${c.nif}, con domicilio en ${b.dirCl}${b.contBl}, en adelante "el Cliente".</p>
<p>Ambas partes intervienen en su propio nombre y derecho y se reconocen mutuamente capacidad legal suficiente para suscribir el presente contrato, a cuyo efecto,</p>

<h2>EXPONEN</h2>
<p>I. Que el Profesional desarrolla actividad economica en el ambito del diseno web, marketing digital y servicios afines.</p>
<p>II. Que el Cliente desea contratar los servicios profesionales del Profesional para la ejecucion del trabajo descrito en la clausula primera.</p>
<p>III. Que ambas partes han alcanzado un acuerdo sobre el alcance, plazo, precio y condiciones de la prestacion.</p>

<h2>CLAUSULAS</h2>

<h3>Primera. Objeto</h3>
<p>El Profesional prestara al Cliente, en regimen de arrendamiento de servicios profesionales, los siguientes servicios:</p>
${b.tabla}
${b.descBl}
<p>La relacion entre las partes es estrictamente mercantil y profesional, no existiendo ningun tipo de vinculo laboral, de exclusividad ni de subordinacion entre ellas.</p>

<h3>Segunda. Duracion</h3>
<p>El presente contrato entrara en vigor en la fecha de su firma y finalizara con la entrega integra del trabajo, prevista en un plazo de ${c.plazo || 'a determinar'}.</p>

<h3>Tercera. Precio y forma de pago</h3>
<div class="tot"><p>Base imponible: <strong>${fmtEuros(t.base)}</strong></p><p>IVA (${c.iva}%): <strong>${fmtEuros(t.iva)}</strong></p><p class="tot-final">TOTAL: ${fmtEuros(t.total)}</p></div>
<p>Forma de pago: ${b.fpTxt}</p>
${b.ibanBl}

<h3>Cuarta. Gastos de publicidad y servicios contratados a terceros</h3>
<p>Cuando el servicio incluya gestion de campanas publicitarias en plataformas de terceros (Meta Ads, Google Ads, etc.), el coste de la inversion publicitaria es independiente del precio acordado y sera directamente abonado por el Cliente al proveedor correspondiente. Lo mismo aplica a hosting, dominios, plugins premium y licencias de software.</p>

<h3>Quinta. Obligaciones del Cliente</h3>
<p>El Cliente se obliga a: (a) facilitar al Profesional, en tiempo y forma, todos los materiales, accesos, contrasenas e informacion necesarios; (b) revisar las entregas dentro de los plazos pactados; (c) abonar puntualmente las cantidades pactadas; (d) garantizar la titularidad sobre los materiales aportados.</p>

<h3>Sexta. Obligaciones del Profesional</h3>
<p>El Profesional se obliga a: (a) prestar el servicio con la diligencia profesional exigible; (b) cumplir el plazo de entrega salvo causas justificadas; (c) mantener informado al Cliente del estado del trabajo; (d) guardar confidencialidad sobre la informacion a la que tenga acceso.</p>

<h3>Septima. Entrega y aceptacion</h3>
<p>El Cliente dispondra de SIETE (7) dias naturales desde la entrega para revisar el trabajo y notificar por escrito cualquier observacion. Transcurrido dicho plazo sin manifestacion expresa, el trabajo se entendera tacitamente aceptado.</p>

<h3>Octava. Propiedad intelectual y cesion de derechos</h3>
<p>Los terminos de cesion de derechos sobre el trabajo realizado se rigen por el documento "Cesion de Derechos y Proteccion de Datos" anexo al presente, que las partes firman en unidad de acto.</p>

<h3>Novena. Confidencialidad</h3>
<p>Las partes se obligan reciprocamente a guardar absoluta confidencialidad sobre cualquier informacion al que tengan acceso con motivo del presente contrato, durante su vigencia y por un plazo de DOS (2) anos desde su finalizacion.</p>

<h3>Decima. Proteccion de datos personales</h3>
<p>El tratamiento de datos personales se rige por el RGPD y la LOPDGDD. Responsable: ${e.nombre}, NIF ${e.nif}. Contacto: ${e.email}. Finalidad: gestion contractual, prestacion del servicio, facturacion y atencion al Cliente. Conservacion: durante la vigencia y los plazos legales aplicables (minimo 6 anos). Derechos del interesado: acceso, rectificacion, supresion, oposicion, limitacion y portabilidad, ejercitables ante el responsable, asi como reclamacion ante la AEPD (www.aepd.es).</p>

<h3>Undecima. Resolucion del contrato</h3>
<p>El presente contrato podra resolverse por mutuo acuerdo, por incumplimiento grave de cualquiera de las partes (previa notificacion con un plazo razonable para subsanar) o por las demas causas legalmente previstas. En caso de resolucion imputable al Cliente, el Profesional tendra derecho al cobro del trabajo efectivamente realizado.</p>

<h3>Duodecima. Limitacion de responsabilidad</h3>
<p>La responsabilidad del Profesional queda limitada al importe efectivamente abonado por el Cliente. En ningun caso respondera por danos indirectos, lucro cesante, perdida de datos, perdida de oportunidades de negocio ni por fallos atribuibles a servicios de terceros.</p>

<h3>Decimotercera. Notificaciones</h3>
<p>Las notificaciones entre las partes se realizaran por correo electronico: Profesional: ${e.email}. Cliente: ${c.email || '________________'}.</p>

<h3>Decimocuarta. Clausula de subsistencia</h3>
<p>Si alguna de las clausulas fuera declarada nula, dicha declaracion no afectara a la validez del resto del contrato.</p>

<h3>Decimoquinta. Legislacion aplicable y jurisdiccion</h3>
<p>El presente contrato se rige por la legislacion espanola. Para la resolucion de cualquier controversia, las partes se someten a los Juzgados y Tribunales de ${e.ciudad}, sin perjuicio de los fueros imperativamente aplicables cuando el Cliente tenga la consideracion de consumidor conforme al Real Decreto Legislativo 1/2007.</p>

<p>Y en prueba de conformidad, ambas partes firman el presente contrato por duplicado y a un solo efecto.</p>

${bloqueFirmas(c, e, firmaURL)}
`;
}

export function generarPorTipo(tipo, cliente, emisor, firmaURL) {
  if (tipo === 'hoja') return generarHojaEncargo(cliente, emisor, firmaURL);
  if (tipo === 'cesion') return generarCesion(cliente, emisor, firmaURL);
  if (tipo === 'contrato') return generarContrato(cliente, emisor, firmaURL);
  return '';
}

export const TIPOS_DOC = [
  { id: 'hoja', nombre: 'Hoja de Encargo' },
  { id: 'cesion', nombre: 'Cesion de Derechos y Proteccion de Datos' },
  { id: 'contrato', nombre: 'Contrato de Prestacion de Servicios' },
];
