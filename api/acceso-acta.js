import { sql } from './_db.js';
import { jsonResponse } from './_auth.js';
import { descifrar } from './_crypto.js';

const MAX_INTENTOS = 3;
const BLOQUEO_HORAS = 1;

function obtenerIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

// Endpoint PUBLICO (sin auth de admin) para verificar PIN y mostrar accesos.
// Solo accesible con un token valido (que viene del QR del acta).
// Si el PIN es correcto, devuelve los accesos del cliente con contrasenas en claro.
// Si el PIN es incorrecto, incrementa el contador y bloquea tras 3 intentos.
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // GET: devuelve solo info publica del acceso (si esta activo, si esta bloqueado).
      // No requiere PIN. Sirve para que la pagina sepa si pintar el formulario o no.
      const token = req.query.token;
      if (!token) return jsonResponse(res, 400, { error: 'Falta token' });

      const [acceso] = await sql`SELECT * FROM accesos_acta WHERE token = ${token} AND activo = TRUE`;
      if (!acceso) return jsonResponse(res, 404, { error: 'Enlace no valido o desactivado' });

      const ahora = new Date();
      const bloqueado = acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta) > ahora;
      const segundosRestantes = bloqueado
        ? Math.ceil((new Date(acceso.bloqueado_hasta) - ahora) / 1000)
        : 0;

      const [cliente] = await sql`SELECT nombre, numero_cliente FROM clientes WHERE id = ${acceso.cliente_id}`;

      return jsonResponse(res, 200, {
        valido: true,
        cliente_nombre: cliente ? cliente.nombre : '',
        codigo_aceptacion: acceso.codigo_aceptacion,
        bloqueado,
        segundos_restantes: segundosRestantes,
        intentos_usados: acceso.intentos_fallidos,
        max_intentos: MAX_INTENTOS,
      });
    }

    if (req.method === 'POST') {
      // POST: recibe { token, pin } y verifica.
      const { token, pin } = req.body || {};
      if (!token || !pin) {
        return jsonResponse(res, 400, { error: 'Faltan token o pin' });
      }

      const [acceso] = await sql`SELECT * FROM accesos_acta WHERE token = ${token} AND activo = TRUE`;
      if (!acceso) {
        return jsonResponse(res, 404, { error: 'Enlace no valido' });
      }

      // Comprobar bloqueo
      const ahora = new Date();
      if (acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta) > ahora) {
        const segundosRestantes = Math.ceil((new Date(acceso.bloqueado_hasta) - ahora) / 1000);
        return jsonResponse(res, 429, {
          error: 'Acceso bloqueado por intentos fallidos',
          segundos_restantes: segundosRestantes,
        });
      }

      // Verificar PIN
      const pinCorrecto = descifrar(acceso.pin_cifrado);
      const ip = obtenerIp(req);
      const userAgent = req.headers['user-agent'] || '';

      if (String(pin).trim() !== pinCorrecto) {
        // Intento fallido
        const nuevosFallos = (acceso.intentos_fallidos || 0) + 1;
        let bloqueoHasta = null;
        if (nuevosFallos >= MAX_INTENTOS) {
          bloqueoHasta = new Date();
          bloqueoHasta.setHours(bloqueoHasta.getHours() + BLOQUEO_HORAS);
        }

        await sql`
          UPDATE accesos_acta SET
            intentos_fallidos = ${nuevosFallos},
            bloqueado_hasta = ${bloqueoHasta ? bloqueoHasta.toISOString() : null},
            actualizado_en = NOW()
          WHERE id = ${acceso.id}
        `;

        await sql`
          INSERT INTO log_acceso_acta (acceso_acta_id, ip, user_agent, exitoso)
          VALUES (${acceso.id}, ${ip}, ${userAgent}, FALSE)
        `;

        if (bloqueoHasta) {
          return jsonResponse(res, 429, {
            error: 'PIN incorrecto. Has agotado los intentos. Acceso bloqueado durante 1 hora.',
            bloqueado: true,
          });
        }
        return jsonResponse(res, 401, {
          error: 'PIN incorrecto',
          intentos_restantes: MAX_INTENTOS - nuevosFallos,
        });
      }

      // PIN correcto: resetear contador, registrar acceso exitoso
      await sql`
        UPDATE accesos_acta SET
          intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          visitas = visitas + 1,
          ultimo_acceso = NOW(),
          actualizado_en = NOW()
        WHERE id = ${acceso.id}
      `;
      await sql`
        INSERT INTO log_acceso_acta (acceso_acta_id, ip, user_agent, exitoso)
        VALUES (${acceso.id}, ${ip}, ${userAgent}, TRUE)
      `;

      // Cargar accesos del cliente con contrasenas descifradas
      const filas = await sql`
        SELECT id, categoria, etiqueta, url, usuario, password_cifrado, notas, importante
        FROM accesos
        WHERE cliente_id = ${acceso.cliente_id}
        ORDER BY importante DESC, categoria ASC, etiqueta ASC
      `;
      const accesos = filas.map(r => ({
        id: r.id,
        categoria: r.categoria,
        etiqueta: r.etiqueta,
        url: r.url,
        usuario: r.usuario,
        password: r.password_cifrado ? descifrar(r.password_cifrado) : '',
        notas: r.notas,
        importante: r.importante,
      }));

      const [cliente] = await sql`SELECT nombre, numero_cliente FROM clientes WHERE id = ${acceso.cliente_id}`;

      return jsonResponse(res, 200, {
        ok: true,
        cliente: {
          nombre: cliente.nombre,
          numero: cliente.numero_cliente,
        },
        codigo_aceptacion: acceso.codigo_aceptacion,
        accesos,
      });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
