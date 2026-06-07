// Utilidades para endpoints PUBLICOS (sin login): IP y rate limiting generico.
import { sql } from './_db.js';

export function obtenerIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

// Devuelve true si SE PERMITE la peticion (y la registra); false si excede el limite.
export async function limitar(ip, ruta, limite = 10, ventanaSeg = 60) {
  try {
    if (Math.random() < 0.05) {
      await sql`DELETE FROM peticiones_publicas WHERE cuando < NOW() - INTERVAL '1 hour'`;
    }
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM peticiones_publicas
      WHERE ip = ${ip} AND ruta = ${ruta} AND cuando > NOW() - (${ventanaSeg} || ' seconds')::interval`;
    if (n >= limite) return false;
    await sql`INSERT INTO peticiones_publicas (ip, ruta) VALUES (${ip}, ${ruta})`;
    return true;
  } catch {
    // Si el limitador falla, no bloquees el servicio legitimo.
    return true;
  }
}
