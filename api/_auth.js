// Verificacion de password de la app.
// Cada llamada a la API valida la cabecera X-App-Password contra
// process.env.APP_PASSWORD.

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
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(data));
}
