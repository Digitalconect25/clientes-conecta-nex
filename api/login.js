import { jsonResponse } from './_auth.js';
import { obtenerIp, comprobarRateLimit, registrarIntento } from './_rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return jsonResponse(res, 500, { error: 'APP_PASSWORD no configurada en servidor' });
  }

  const ip = obtenerIp(req);

  try {
    const limit = await comprobarRateLimit(ip);
    if (limit.bloqueado) {
      return jsonResponse(res, 429, {
        error: `Demasiados intentos fallidos. Espera ${limit.segundosRestantes} segundos.`,
      });
    }
  } catch (err) {
    console.error('Rate limit error:', err.message);
    // Si la BD esta caida no bloqueamos el login, solo log
  }

  const { password } = req.body || {};
  const exitoso = password === expected;

  try {
    await registrarIntento(ip, exitoso);
  } catch (err) {
    console.error('Error registrando intento:', err.message);
  }

  if (exitoso) {
    return jsonResponse(res, 200, { ok: true });
  }
  return jsonResponse(res, 401, { error: 'Password incorrecta' });
}
