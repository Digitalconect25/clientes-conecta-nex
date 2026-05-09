import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

// Regenera pagos de un cliente segun sus servicios y forma de pago.
// Pensado para casos de recuperacion (incidente DROP, cliente al que se
// le perdieron los pagos pero conserva servicios y contrato).
//
// Body:
//   { cliente_id: number, modo: 'simular' | 'aplicar' }
//
// modo='simular' devuelve los pagos que se crearian SIN tocar la BD.
// modo='aplicar' los inserta de verdad.
//
// IMPORTANTE: nunca borra ni modifica pagos existentes. Solo anade
// los que faltan. Si al simular ves duplicados, primero borra los
// pagos viejos manualmente desde la pestana Pagos del cliente.

const SERVICIOS_RECURRENTES = [
  'Plan Mantenimiento',
  'Plan Crecimiento',
  'Plan Cliente Activo',
  'Bot WhatsApp con IA',
];

function fmtFecha(d) {
  return d.toISOString().split('T')[0];
}

function calcularPagosPropuestos(cliente) {
  const servicios = cliente.servicios_json || [];
  const total = parseFloat(cliente.total) || 0;
  const formaPago = cliente.forma_pago || '50% al inicio, 50% a la entrega';

  // Fecha base: si el cliente tiene fecha_firma o fecha_inicio, usarla.
  // Si no, hoy.
  let fechaBase;
  if (cliente.fecha_firma) fechaBase = new Date(cliente.fecha_firma);
  else if (cliente.fecha_inicio) fechaBase = new Date(cliente.fecha_inicio);
  else fechaBase = new Date();

  const en7 = new Date(fechaBase); en7.setDate(en7.getDate() + 7);
  const en30 = new Date(fechaBase); en30.setDate(en30.getDate() + 30);

  const propuestos = [];

  // Pagos iniciales segun forma de pago
  if (formaPago === '50% al inicio, 50% a la entrega') {
    propuestos.push({
      concepto: '50% inicial',
      importe: Math.round(total * 50) / 100,
      fecha_esperada: fmtFecha(en7),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
    propuestos.push({
      concepto: '50% a la entrega',
      importe: Math.round(total * 50) / 100,
      fecha_esperada: fmtFecha(en30),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
  } else if (formaPago === '30% al inicio, 70% a la entrega') {
    propuestos.push({
      concepto: '30% inicial',
      importe: Math.round(total * 30) / 100,
      fecha_esperada: fmtFecha(en7),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
    propuestos.push({
      concepto: '70% a la entrega',
      importe: Math.round(total * 70) / 100,
      fecha_esperada: fmtFecha(en30),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
  } else if (formaPago === '100% al inicio') {
    propuestos.push({
      concepto: 'Pago unico inicial',
      importe: total,
      fecha_esperada: fmtFecha(en7),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
  } else if (formaPago === '100% a la entrega') {
    propuestos.push({
      concepto: 'Pago unico a la entrega',
      importe: total,
      fecha_esperada: fmtFecha(en30),
      estado: 'Pendiente',
      es_recurrente: false,
      mes_recurrencia: null,
    });
  } else if (formaPago === 'Cuota mensual recurrente') {
    // No hay pago inicial. Solo recurrentes (se generan abajo).
  }

  // Recurrentes mensuales: 12 cuotas a partir del mes que viene
  const recurrentes = servicios.filter(s => SERVICIOS_RECURRENTES.includes(s.nombre));
  if (recurrentes.length > 0) {
    for (let mes = 1; mes <= 12; mes++) {
      const fecha = new Date(fechaBase);
      fecha.setMonth(fecha.getMonth() + mes);
      fecha.setDate(1);
      const mesEtq = fecha.toISOString().slice(0, 7);
      for (const s of recurrentes) {
        const importe = (parseFloat(s.cantidad) || 1) * (parseFloat(s.precio) || 0);
        propuestos.push({
          concepto: s.nombre + ' - cuota mensual',
          importe,
          fecha_esperada: fmtFecha(fecha),
          estado: 'Pendiente',
          es_recurrente: true,
          mes_recurrencia: mesEtq,
        });
      }
    }
  }

  return propuestos;
}

// Detecta duplicados aproximados: mismo concepto + mismo mes_recurrencia
// (si recurrente) o concepto exacto (si no).
function esDuplicado(propuesto, existentes) {
  return existentes.some(p => {
    if (propuesto.es_recurrente) {
      return p.concepto === propuesto.concepto && p.mes_recurrencia === propuesto.mes_recurrencia;
    }
    return p.concepto === propuesto.concepto;
  });
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { cliente_id, modo } = req.body || {};
    if (!cliente_id) return jsonResponse(res, 400, { error: 'Falta cliente_id' });
    if (modo !== 'simular' && modo !== 'aplicar') {
      return jsonResponse(res, 400, { error: 'modo debe ser "simular" o "aplicar"' });
    }

    const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${cliente_id}`;
    if (!cliente) return jsonResponse(res, 404, { error: 'Cliente no encontrado' });

    const existentes = await sql`SELECT * FROM pagos WHERE cliente_id = ${cliente_id}`;
    const propuestos = calcularPagosPropuestos(cliente);

    const aCrear = propuestos.filter(p => !esDuplicado(p, existentes));
    const yaExisten = propuestos.length - aCrear.length;

    const resumen = {
      cliente: { id: cliente.id, nombre: cliente.nombre, total: cliente.total, forma_pago: cliente.forma_pago },
      pagos_existentes: existentes.length,
      pagos_propuestos_total: propuestos.length,
      pagos_a_crear: aCrear.length,
      pagos_ya_existentes: yaExisten,
      vista_previa: aCrear.slice(0, 50),
    };

    if (modo === 'simular') {
      return jsonResponse(res, 200, { ...resumen, modo: 'simular', creados: 0 });
    }

    // modo === 'aplicar'
    let creados = 0;
    for (const p of aCrear) {
      await sql`
        INSERT INTO pagos (
          cliente_id, concepto, importe, fecha_esperada, estado,
          es_recurrente, mes_recurrencia, metodo
        ) VALUES (
          ${cliente_id}, ${p.concepto}, ${p.importe}, ${p.fecha_esperada}, ${p.estado},
          ${p.es_recurrente}, ${p.mes_recurrencia}, 'Transferencia'
        )
      `;
      creados++;
    }

    return jsonResponse(res, 200, { ...resumen, modo: 'aplicar', creados });
  } catch (err) {
    console.error('Error regenerar-pagos:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
