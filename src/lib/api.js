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
  archivoDelete: (id) => request('DELETE', `/api/archivos?id=${id}`),
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
};
