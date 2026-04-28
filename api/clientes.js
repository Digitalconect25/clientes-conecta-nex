import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

async function siguienteNumero(clave, prefijo) {
  const anio = new Date().getFullYear();
  const claveAnual = `${clave}_${anio}`;
  const [row] = await sql`
    INSERT INTO contadores (clave, valor)
    VALUES (${claveAnual}, 1)
    ON CONFLICT (clave) DO UPDATE SET valor = contadores.valor + 1, actualizado_en = NOW()
    RETURNING valor
  `;
  return `${prefijo}-${anio}-${String(row.valor).padStart(4, '0')}`;
}

function calcularTotales(serviciosArray, ivaPct) {
  let base = 0;
  (serviciosArray || []).forEach((s) => {
    const cant = parseFloat(s.cantidad) || 0;
    const prec = parseFloat(s.precio) || 0;
    base += cant * prec;
  });
  const iva = base * (parseFloat(ivaPct) || 0) / 100;
  return { base, iva, total: base + iva };
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM clientes WHERE id = ${req.query.id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });
        return jsonResponse(res, 200, row);
      }
      const rows = await sql`SELECT * FROM clientes ORDER BY creado_en DESC`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const c = req.body || {};
      if (!c.nombre || !c.nif) return jsonResponse(res, 400, { error: 'Nombre y NIF obligatorios' });

      const numeroCliente = await siguienteNumero('cliente', 'CL');
      const totales = calcularTotales(c.servicios_json, c.iva);

      const [row] = await sql`
        INSERT INTO clientes (
          numero_cliente, estado, tipo_persona, nombre, nif, contacto,
          direccion, cp, ciudad, provincia, pais, email, telefono,
          servicios_json, descripcion, plazo, forma_pago, iva,
          base_imponible, iva_importe, total, notas
        ) VALUES (
          ${numeroCliente}, ${c.estado || 'Pendiente firma'}, ${c.tipo_persona || 'Fisica'},
          ${c.nombre}, ${c.nif.toUpperCase()}, ${c.contacto || ''},
          ${c.direccion || ''}, ${c.cp || ''}, ${c.ciudad || ''}, ${c.provincia || 'Alicante'},
          ${c.pais || 'Espana'}, ${c.email || ''}, ${c.telefono || ''},
          ${JSON.stringify(c.servicios_json || [])}::jsonb, ${c.descripcion || ''},
          ${c.plazo || ''}, ${c.forma_pago || '50% al inicio, 50% a la entrega'},
          ${c.iva || 21}, ${totales.base}, ${totales.iva}, ${totales.total}, ${c.notas || ''}
        ) RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const c = req.body || {};
      if (!c.id) return jsonResponse(res, 400, { error: 'Falta id' });

      let numeroContrato = c.numero_contrato;
      if (c.generar_contrato && !numeroContrato) {
        numeroContrato = await siguienteNumero('contrato', 'CN');
      }

      const totales = calcularTotales(c.servicios_json, c.iva);

      const [row] = await sql`
        UPDATE clientes SET
          numero_contrato = ${numeroContrato || null},
          estado = ${c.estado || 'Pendiente firma'},
          tipo_persona = ${c.tipo_persona || 'Fisica'},
          nombre = ${c.nombre},
          nif = ${(c.nif || '').toUpperCase()},
          contacto = ${c.contacto || ''},
          direccion = ${c.direccion || ''},
          cp = ${c.cp || ''},
          ciudad = ${c.ciudad || ''},
          provincia = ${c.provincia || 'Alicante'},
          pais = ${c.pais || 'Espana'},
          email = ${c.email || ''},
          telefono = ${c.telefono || ''},
          servicios_json = ${JSON.stringify(c.servicios_json || [])}::jsonb,
          descripcion = ${c.descripcion || ''},
          plazo = ${c.plazo || ''},
          forma_pago = ${c.forma_pago || '50% al inicio, 50% a la entrega'},
          iva = ${c.iva || 21},
          base_imponible = ${totales.base},
          iva_importe = ${totales.iva},
          total = ${totales.total},
          notas = ${c.notas || ''},
          firma_cliente = ${c.firma_cliente || ''},
          fecha_firma = ${c.fecha_firma || null},
          actualizado_en = NOW()
        WHERE id = ${c.id}
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM clientes WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
