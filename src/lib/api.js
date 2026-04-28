// Helper para todas las llamadas a la API
// Mete automaticamente el header X-App-Password

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Error en la peticion');
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

export const api = {
  // login
  login: async (password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error('Password incorrecta');
    setPassword(password);
    return true;
  },

  // emisor
  emisorGet: () => request('GET', '/api/emisor'),
  emisorUpdate: (data) => request('PUT', '/api/emisor', data),

  // servicios
  serviciosList: () => request('GET', '/api/servicios'),
  servicioCreate: (data) => request('POST', '/api/servicios', data),
  servicioUpdate: (data) => request('PUT', '/api/servicios', data),
  servicioDelete: (id) => request('DELETE', `/api/servicios?id=${id}`),

  // clientes
  clientesList: () => request('GET', '/api/clientes'),
  clienteGet: (id) => request('GET', `/api/clientes?id=${id}`),
  clienteCreate: (data) => request('POST', '/api/clientes', data),
  clienteUpdate: (data) => request('PUT', '/api/clientes', data),
  clienteDelete: (id) => request('DELETE', `/api/clientes?id=${id}`),

  // documentos
  documentosList: (clienteId) => request('GET', `/api/documentos?cliente_id=${clienteId}`),
  documentoCreate: (data) => request('POST', '/api/documentos', data),
  documentoUpdate: (data) => request('PUT', '/api/documentos', data),
  documentoDelete: (id) => request('DELETE', `/api/documentos?id=${id}`),

  // archivos
  archivosList: (clienteId) => request('GET', `/api/archivos?cliente_id=${clienteId}`),
  archivoUpload: (data) => request('POST', '/api/archivos', data),
  archivoDownloadUrl: (id) => `/api/archivos?id=${id}`,
  archivoDelete: (id) => request('DELETE', `/api/archivos?id=${id}`),
};
