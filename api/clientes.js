import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

const SERVICIOS_RECURRENTES = ['Plan Mantenimiento', 'Plan Crecimiento', 'Plan Cliente Activo', 'Bot WhatsApp con IA'];

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

async function generarPagosIniciales(clienteId, totales, formaPago, servicios) {
  // Cuotas no recurrentes
  const total = totales.total;
  const hoy = new Date();
  const en7Dias = new Date(); en7Dias.setDate(hoy.getDate() + 7);
  const en30Dias = new Date(); en30Dias.setDate(hoy.getDate() + 30);

  const fmtFecha = (d) => d.toISOString().split('T')[0];

  if (formaPago === '50% al inicio, 50% a la entrega') {
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, '50% inicial', ${total * 0.5}, ${fmtFecha(en7Dias)}, 'Pendiente')`;
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, '50% a la entrega', ${total * 0.5}, ${fmtFecha(en30Dias)}, 'Pendiente')`;
  } else if (formaPago === '30% al inicio, 70% a la entrega') {
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, '30% inicial', ${total * 0.3}, ${fmtFecha(en7Dias)}, 'Pendiente')`;
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, '70% a la entrega', ${total * 0.7}, ${fmtFecha(en30Dias)}, 'Pendiente')`;
  } else if (formaPago === '100% al inicio') {
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, 'Pago unico inicial', ${total}, ${fmtFecha(en7Dias)}, 'Pendiente')`;
  } else if (formaPago === '100% a la entrega') {
    await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado) VALUES (${clienteId}, 'Pago unico a la entrega', ${total}, ${fmtFecha(en30Dias)}, 'Pendiente')`;
  }

  // Cuotas mensuales recurrentes para servicios mensuales (los proximos 12 meses)
  const recurrentes = (servicios || []).filter(s => SERVICIOS_RECURRENTES.includes(s.nombre));
  if (recurrentes.length > 0) {
    for (let mes = 1; mes <= 12; mes++) {
      const fecha = new Date(hoy);
      fecha.setMonth(fecha.getMonth() + mes);
      fecha.setDate(1);
      const mesEtq = fecha.toISOString().slice(0, 7);
      for (const s of recurrentes) {
        const importe = (parseFloat(s.cantidad) || 1) * (parseFloat(s.precio) || 0);
        await sql`INSERT INTO pagos (cliente_id, concepto, importe, fecha_esperada, estado, es_recurrente, mes_recurrencia)
          VALUES (${clienteId}, ${s.nombre + ' - cuota mensual'}, ${importe}, ${fmtFecha(fecha)}, 'Pendiente', TRUE, ${mesEtq})`;
      }
    }
  }
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
          base_imponible, iva_importe, total, notas,
          estado_proyecto, porcentaje_avance
        ) VALUES (
          ${numeroCliente}, ${c.estado || 'Pendiente firma'}, ${c.tipo_persona || 'Fisica'},
          ${c.nombre}, ${c.nif.toUpperCase()}, ${c.contacto || ''},
          ${c.direccion || ''}, ${c.cp || ''}, ${c.ciudad || ''}, ${c.provincia || 'Alicante'},
          ${c.pais || 'Espana'}, ${c.email || ''}, ${c.telefono || ''},
          ${JSON.stringify(c.servicios_json || [])}::jsonb, ${c.descripcion || ''},
          ${c.plazo || ''}, ${c.forma_pago || '50% al inicio, 50% a la entrega'},
          ${c.iva || 21}, ${totales.base}, ${totales.iva}, ${totales.total}, ${c.notas || ''},
          'Sin iniciar', 0
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
          estado_proyecto = ${c.estado_proyecto || 'Sin iniciar'},
          porcentaje_avance = ${c.porcentaje_avance != null ? c.porcentaje_avance : 0},
          fecha_inicio = ${c.fecha_inicio || null},
          fecha_fin_prevista = ${c.fecha_fin_prevista || null},
          fecha_fin_real = ${c.fecha_fin_real || null},
          notas_proyecto = ${c.notas_proyecto || ''},
          actualizado_en = NOW()
        WHERE id = ${c.id}
        RETURNING *
      `;

      // Si se acaba de generar el numero de contrato, generamos los pagos automaticamente
      if (c.generar_contrato && numeroContrato) {
        const existentes = await sql`SELECT COUNT(*) AS n FROM pagos WHERE cliente_id = ${c.id}`;
        if (parseInt(existentes[0].n, 10) === 0) {
          await generarPagosIniciales(c.id, totales, row.forma_pago, row.servicios_json);
        }
      }

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
