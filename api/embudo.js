// Embudo de contratación: para cada cliente calcula en qué FASE del circuito está
// (datos -> contrato -> firma -> validación -> en curso), uniendo el estado del
// cliente con el de su último documento de contrato. Solo lectura, requiere login.
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { asegurarColumnas } from './documentos.js';

// Documentos que representan "el contrato" en el circuito.
const TIPOS_CONTRATO = ['paquete', 'contrato', 'hoja', 'encargo_tratamiento'];

// Devuelve la clave de fase para un cliente dado su último doc de contrato.
function calcularFase(c, doc) {
  if (c.estado === 'Cancelado') return 'cancelado';
  if (doc) {
    if (doc.firma_estado === 'rechazado') return 'rechazado';
    if (doc.validado_agencia_en) {
      if (c.estado === 'Entregado' || c.estado_proyecto === 'Entregado') return 'entregado';
      return 'en_curso';
    }
    if (doc.firmado) return 'validacion_pendiente';
    if (doc.firma_estado === 'enviado' || doc.firma_estado === 'visto') return 'firma_pendiente';
  }
  if (c.estado === 'Entregado' || c.estado_proyecto === 'Entregado') return 'entregado';
  if ((c.datos_estado || 'pendiente') === 'completado') return 'contrato_pendiente';
  return 'datos_pendientes';
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    await asegurarColumnas();
    try { await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS datos_estado TEXT DEFAULT 'pendiente'`; } catch { /* noop */ }

    const clientes = await sql`
      SELECT id, numero_cliente, nombre, email, telefono, estado, estado_proyecto,
             COALESCE(datos_estado,'pendiente') AS datos_estado, doc_identidad, total, creado_en
      FROM clientes ORDER BY creado_en DESC`;

    const docs = await sql`
      SELECT id, cliente_id, tipo, nombre, COALESCE(firma_estado,'borrador') AS firma_estado,
             firmado, fecha_firma, firma_ref, firma_token, validacion_token,
             validado_agencia_en, firmante_nombre, firma_enviada_en, creado_en
      FROM documentos
      WHERE tipo = ANY(${TIPOS_CONTRATO})
      ORDER BY creado_en DESC`;

    // El más reciente por cliente (docs viene ya ordenado DESC).
    const ultimoPorCliente = {};
    for (const d of docs) { if (!ultimoPorCliente[d.cliente_id]) ultimoPorCliente[d.cliente_id] = d; }

    const filas = clientes.map((c) => {
      const doc = ultimoPorCliente[c.id] || null;
      return { ...c, fase: calcularFase(c, doc), doc };
    });

    return jsonResponse(res, 200, { clientes: filas });
  } catch (err) {
    console.error('embudo error:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
