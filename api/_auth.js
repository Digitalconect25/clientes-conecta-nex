// Verificacion simple de password de la app
// La password se establece en Vercel como APP_PASSWORD
// El frontend la guarda en localStorage tras hacer login
// Cada llamada API la envia en header X-App-Password

export function checkAuth(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return { ok: false, error: 'APP_PASSWORD no configurada en servidor' };
  }
  const provided = req.headers['x-app-password'];
  if (provided !== expected) {
    return { ok: false, error: 'No autorizado' };
  }
  return { ok: true };
}

export function jsonResponse(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data));
}
