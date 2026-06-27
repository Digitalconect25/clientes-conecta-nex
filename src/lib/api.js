const PASSWORD_KEY = 'cn_password';

export function getPassword() {
  return localStorage.getItem(PASSWORD_KEY) || '';
}
export function setPassword(p) {
  localStorage.setItem(PASSWORD_KEY, p);
}
export function clearPassword() {
  localStorage.removeItem(PASSWORD_KEY);
}

async function request(method, url, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Password': getPassword(),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.status === 401) {
    clearPassword();
    window.location.href = '/login';
    throw new Error('No autorizado');
  }
  if (res.status === 429) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Demasiados intentos');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Error en la peticion');
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

// Descarga binaria autenticada. Llama al endpoint con X-App-Password,
// recibe el blob y dispara la descarga programaticamente. Esto reemplaza
// el viejo <a href="..."> que no podia mandar la cabecera de auth.
export async function descargarArchivo(idArchivo, nombreSugerido) {
  const res = await fetch(`/api/archivos?id=${idArchivo}`, {
    headers: { 'X-App-Password': getPassword() },
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearPassword();
      window.location.href = '/login';
    }
    throw new Error('No se pudo descargar el archivo (' + res.status + ')');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreSugerido || 'archivo';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  login: async (password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 429) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Demasiados intentos. Espera un momento.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Password incorrecta');
    }
    setPassword(password);
    return true;
  },

  emisorGet: () => request('GET', '/api/emisor'),
  emisorUpdate: (data) => request('PUT', '/api/emisor', data),

  serviciosList: () => request('GET', '/api/servicios'),
  servicioCreate: (data) => request('POST', '/api/servicios', data),
  servicioUpdate: (data) => request('PUT', '/api/servicios', data),
  servicioDelete: (id) => request('DELETE', `/api/servicios?id=${id}`),

  clientesList: () => request('GET', '/api/clientes'),
  clienteGet: (id) => request('GET', `/api/clientes?id=${id}`),
  clienteCreate: (data) => request('POST', '/api/clientes', data),
  clienteUpdate: (data) => request('PUT', '/api/clientes', data),
  clienteDelete: (id) => request('DELETE', `/api/clientes?id=${id}`),

  documentosList: (clienteId) => request('GET', `/api/documentos?cliente_id=${clienteId}`),
  documentoGet: (id) => request('GET', `/api/documentos?id=${id}`),
  documentoCreate: (data) => request('POST', '/api/documentos', data),
  documentoUpdate: (data) => request('PUT', '/api/documentos', data),
  documentoDelete: (id) => request('DELETE', `/api/documentos?id=${id}`),

  archivosList: (clienteId) => request('GET', `/api/archivos?cliente_id=${clienteId}`),
  archivoUpload: (data) => request('POST', '/api/archivos', data),
  archivoUpdate: (data) => request('PUT', '/api/archivos', data),
  archivoDelete: (id) => request('DELETE', `/api/archivos?id=${id}`),
  archivoComoDataURL: (id) => request('GET', `/api/archivos?id=${id}&formato=dataurl`),
  archivoDescargar: descargarArchivo,

  pagosList: (clienteId) => request('GET', clienteId ? `/api/pagos?cliente_id=${clienteId}` : '/api/pagos'),
  pagoCreate: (data) => request('POST', '/api/pagos', data),
  pagoUpdate: (data) => request('PUT', '/api/pagos', data),
  pagoDelete: (id) => request('DELETE', `/api/pagos?id=${id}`),

  // Fases del proyecto
  fasesList: (clienteId) => request('GET', clienteId ? `/api/fases?cliente_id=${clienteId}` : '/api/fases'),
  faseCreate: (data) => request('POST', '/api/fases', data),
  faseUpdate: (data) => request('PUT', '/api/fases', data),
  faseDelete: (id) => request('DELETE', `/api/fases?id=${id}`),
  aplicarPlantilla: (clienteId, sustituir) => request('POST', '/api/aplicar-plantilla', { cliente_id: clienteId, sustituir: !!sustituir }),

  // Accesos del cliente (credenciales)
  accesosList: (clienteId, conPassword) => request('GET', `/api/accesos?cliente_id=${clienteId}${conPassword ? '&con_password=1' : ''}`),
  accesoCreate: (data) => request('POST', '/api/accesos', data),
  accesoUpdate: (data) => request('PUT', '/api/accesos', data),
  accesoDelete: (id) => request('DELETE', `/api/accesos?id=${id}`),

  // Email de actas
  emailEstado: () => request('GET', '/api/enviar-acta'),
  enviarActa: (data) => request('POST', '/api/enviar-acta', data),

  // Entregables del proyecto (Acta Progresiva)
  entregablesList: (clienteId) => request('GET', `/api/entregables?cliente_id=${clienteId}`),
  entregableCreate: (data) => request('POST', '/api/entregables', data),
  entregableUpdate: (data) => request('PUT', '/api/entregables', data),
  entregableDelete: (id) => request('DELETE', `/api/entregables?id=${id}`),
  aplicarEntregables: (clienteId, sustituir) => request('POST', '/api/aplicar-entregables', { cliente_id: clienteId, sustituir: !!sustituir }),

  // Acceso seguro al acta (QR + PIN)
  generarAccesoActa: (clienteId, documentoId, enviarEmail) => request('POST', '/api/generar-acceso-acta', {
    cliente_id: clienteId,
    documento_id: documentoId,
    enviar_email: !!enviarEmail,
  }),
  accesosActaList: (clienteId, conPin) => request('GET', `/api/accesos-acta-admin?cliente_id=${clienteId}${conPin ? '&con_pin=1' : ''}`),
  accesoActaAccion: (id, accion) => request('PUT', '/api/accesos-acta-admin', { id, accion }),
  accesoActaDelete: (id) => request('DELETE', `/api/accesos-acta-admin?id=${id}`),
  // Reenviar PIN al cliente por email (si lo borro o lo perdio)
  reenviarPinActa: (id, emailDestino) => request('POST', '/api/reenviar-pin-acta', {
    id,
    email_destino: emailDestino || '',
  }),

  // Plantillas de email
  emailPlantillasList: () => request('GET', '/api/email-plantillas'),
  emailPlantillaGet: (id) => request('GET', `/api/email-plantillas?id=${id}`),
  emailPlantillaCreate: (data) => request('POST', '/api/email-plantillas', data),
  emailPlantillaUpdate: (data) => request('PUT', '/api/email-plantillas', data),
  emailPlantillaDelete: (id) => request('DELETE', `/api/email-plantillas?id=${id}`),

  // Emails enviados (historial + envio)
  emailsList: (clienteId, limit) => {
    const params = [];
    if (clienteId) params.push(`cliente_id=${clienteId}`);
    if (limit) params.push(`limit=${limit}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return request('GET', `/api/emails-enviados${qs}`);
  },
  emailEnviar: (data) => request('POST', '/api/emails-enviados', data),
  emailDelete: (id) => request('DELETE', `/api/emails-enviados?id=${id}`),

  // IA - Redactar y mejorar emails con Groq (gratis)
  iaEstado: () => request('GET', '/api/ia-redactar'),
  iaRedactar: (instruccion, clienteId) => request('POST', '/api/ia-redactar', {
    accion: 'redactar',
    instruccion,
    cliente_id: clienteId || null,
  }),
  iaMejorar: (borrador, clienteId) => request('POST', '/api/ia-redactar', {
    accion: 'mejorar',
    borrador,
    cliente_id: clienteId || null,
  }),

  // Regeneracion de pagos (recuperacion tras incidente o ajuste)
  regenerarPagos: (clienteId, modo) => request('POST', '/api/regenerar-pagos', {
    cliente_id: clienteId,
    modo: modo || 'simular',
  }),

  // Captacion en frio (prospeccion)
  prospectosList: () => request('GET', '/api/prospectos'),
  prospectoGet: (id) => request('GET', `/api/prospectos?id=${id}`),
  prospectoCrear: (data) => request('POST', '/api/prospectos', { accion: 'crear', ...data }),
  prospectoImportar: (filas) => request('POST', '/api/prospectos', { accion: 'importar', filas }),
  prospectoGenerar: (id) => request('POST', '/api/prospectos', { accion: 'generar', id }),
  prospectoEnviar: (id, data) => request('POST', '/api/prospectos', { accion: 'enviar', id, ...(data || {}) }),
  prospectosGenerarTodos: () => request('POST', '/api/prospectos', { accion: 'generar_todos' }),
  prospectosPuntuar: () => request('POST', '/api/prospectos', { accion: 'puntuar_todos' }),
  prospectosEnviarTodos: () => request('POST', '/api/prospectos', { accion: 'enviar_todos' }),
  prospectoActualizar: (data) => request('PUT', '/api/prospectos', data),
  prospectoBorrar: (id) => request('DELETE', `/api/prospectos?id=${id}`),
  prospectosBorrarVarios: (ids) => request('POST', '/api/prospectos', { accion: 'borrar_varios', ids }),
  prospectosVaciar: (estado) => request('POST', '/api/prospectos', { accion: 'vaciar', estado: estado || null }),
  prospectoConvertir: (id, datos) => request('POST', '/api/prospectos', { accion: 'convertir', id, ...datos }),
  prospectoEmailPrueba: (email) => request('POST', '/api/prospectos', { accion: 'email_prueba', email }),

  // Bandeja de entrada (respuestas)
  mensajesList: () => request('GET', '/api/mensajes'),
  mensajeLeido: (id, leido) => request('PUT', '/api/mensajes', { id, leido }),
  mensajeDelete: (id) => request('DELETE', `/api/mensajes?id=${id}`),

  // Agenda de citas
  citasList: () => request('GET', '/api/citas'),
  citaCrear: (data) => request('POST', '/api/citas', data),
  citaUpdate: (data) => request('PUT', '/api/citas', data),
  citaDelete: (id) => request('DELETE', `/api/citas?id=${id}`),
  // Dossier "base para presentar" (IA): genera/regenera la ficha de reunión de una cita.
  citaDossier: (id) => request('POST', '/api/dossier', { id }),
};

// Endpoint PUBLICO de acceso al acta (sin auth de admin)
// Lo usan los clientes desde la pagina /acceso/:token
export async function verificarAccesoActa(token) {
  const res = await fetch(`/api/acceso-acta?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo cargar');
  }
  return res.json();
}

export async function entrarConPIN(token, pin) {
  const res = await fetch('/api/acceso-acta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, ...data };
  }
  return { ok: true, ...data };
}
