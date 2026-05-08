// Rate limiting basico para el login.
// Cuenta intentos fallidos por IP en los ultimos 60 segundos.
// Si llega a 5, rechaza durante 5 minutos.

import { sql } from './_db.js';

const VENTANA_SEGUNDOS = 60;
const LIMITE_INTENTOS = 5;
const BLOQUEO_MINUTOS = 5;

export function obtenerIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

export async function comprobarRateLimit(ip) {
  // Limpia intentos antiguos (mas de 1 hora) ocasionalmente
  if (Math.random() < 0.1) {
    await sql`DELETE FROM intentos_login WHERE cuando < NOW() - INTERVAL '1 hour'`;
  }

  // Si hay un fallo reciente reciente y muchos en la ventana, bloquea
  const [{ fallos }] = await sql`
    SELECT COUNT(*)::int AS fallos FROM intentos_login
    WHERE ip = ${ip}
      AND exitoso = FALSE
      AND cuando > NOW() - (${VENTANA_SEGUNDOS} || ' seconds')::interval
  `;

  if (fallos >= LIMITE_INTENTOS) {
    const [ultimo] = await sql`
      SELECT cuando FROM intentos_login
      WHERE ip = ${ip} AND exitoso = FALSE
      ORDER BY cuando DESC LIMIT 1
    `;
    if (ultimo) {
      const desbloqueoEn = new Date(new Date(ultimo.cuando).getTime() + BLOQUEO_MINUTOS * 60000);
      if (desbloqueoEn > new Date()) {
        const segundosRestantes = Math.ceil((desbloqueoEn - new Date()) / 1000);
        return { bloqueado: true, segundosRestantes };
      }
    }
  }
  return { bloqueado: false };
}

export async function registrarIntento(ip, exitoso) {
  await sql`INSERT INTO intentos_login (ip, exitoso) VALUES (${ip}, ${exitoso})`;
}
