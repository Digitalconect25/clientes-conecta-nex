import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

// Catálogo de servicios IA (calculadora de precios, adaptada a Conecta NEX).
// El "precio" es el SETUP (implementación), ya rebajado un 5%; la cuota mensual
// (también -5%) va en la descripción. Se cargan con la acción seed_ia.
const SERVICIOS_IA = [
  ['Chatbots y asistentes IA', 'Chatbot IA — Básico', 1140, 'FAQ automático, respuestas simples, sin integraciones. Cuota: desde 142,50 €/mes. Entrega: 5-7 días.'],
  ['Chatbots y asistentes IA', 'Chatbot IA — Intermedio', 2375, 'Integración con tu CRM, personalización avanzada y contexto de negocio. Cuota: desde 380 €/mes. Entrega: 10-15 días.'],
  ['Chatbots y asistentes IA', 'Chatbot IA — Avanzado', 4750, 'Multilingüe, flujos complejos e integración con tus sistemas internos. Cuota: desde 760 €/mes. Entrega: 20-30 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Básico', 1710, 'Atiende llamadas, toma datos y agenda citas sencillas. Cuota: desde 285 €/mes. Entrega: 7-10 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Intermedio', 3325, 'Cualifica leads, transfiere de forma inteligente e integra tu calendario. Cuota: desde 570 €/mes. Entrega: 12-18 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Avanzado', 5700, 'Varios departamentos, CRM completo y reporting avanzado. Cuota: desde 950 €/mes. Entrega: 25-35 días.'],
  ['Automatización de procesos', 'Automatización — Básico', 760, '1-3 flujos simples (emails, notificaciones, respuestas automáticas). Cuota: desde 95 €/mes. Entrega: 3-5 días.'],
  ['Automatización de procesos', 'Automatización — Intermedio', 1900, '5-10 flujos con integraciones (Make/n8n + apps externas). Cuota: desde 332,50 €/mes. Entrega: 10-15 días.'],
  ['Automatización de procesos', 'Automatización — Avanzado', 4750, 'Ecosistema completo: múltiples workflows conectados con IA. Cuota: desde 665 €/mes. Entrega: 20-40 días.'],
  ['Agentes IA a medida', 'Agente IA — Básico', 1425, 'Agente especializado en 1 tarea (análisis de documentos, generación de contenido). Cuota: desde 190 €/mes. Entrega: 5-8 días.'],
  ['Agentes IA a medida', 'Agente IA — Intermedio', 2850, 'Agente multifunción con memoria contextual e integraciones. Cuota: desde 475 €/mes. Entrega: 12-20 días.'],
  ['Agentes IA a medida', 'Agente IA — Avanzado', 6650, 'Agente autónomo con toma de decisiones, acceso a herramientas y aprendizaje. Cuota: desde 1.140 €/mes. Entrega: 30-50 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Básico', 855, 'Sistema de generación de posts y emails con plantillas. Cuota: desde 142,50 €/mes. Entrega: 3-5 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Intermedio', 2090, 'Multiplataforma, calendario automatizado y tono de marca. Cuota: desde 380 €/mes. Entrega: 8-12 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Avanzado', 5225, 'Ecosistema completo: generación + publicación + análisis + optimización. Cuota: desde 855 €/mes. Entrega: 15-25 días.'],
];

export default async function handler(req, res) {
  const auth = checkAuth(req);
  // Carga masiva del catálogo IA: autenticada con CRON_SECRET (sin login del panel).
  const seedOk = req.method === 'POST' && req.body?.accion === 'seed_ia'
    && !!process.env.CRON_SECRET && req.body?.secret === process.env.CRON_SECRET;
  if (!auth.ok && !seedOk) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM servicios WHERE activo = TRUE ORDER BY categoria, nombre`;
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      // Cargar el catálogo IA (idempotente: omite los que ya existan por nombre).
      if (req.body?.accion === 'seed_ia') {
        if (!seedOk) return jsonResponse(res, 401, { error: 'no auth' });
        let insertados = 0, omitidos = 0;
        for (const [categoria, nombre, precio, descripcion] of SERVICIOS_IA) {
          const [ya] = await sql`SELECT id FROM servicios WHERE nombre = ${nombre} LIMIT 1`;
          if (ya) { omitidos++; continue; }
          await sql`INSERT INTO servicios (nombre, categoria, precio, descripcion) VALUES (${nombre}, ${categoria}, ${precio}, ${descripcion})`;
          insertados++;
        }
        return jsonResponse(res, 200, { ok: true, insertados, omitidos, total: SERVICIOS_IA.length });
      }

      const { nombre, categoria, precio, descripcion } = req.body || {};
      if (!nombre || !categoria) return jsonResponse(res, 400, { error: 'Faltan campos' });
      const [row] = await sql`
        INSERT INTO servicios (nombre, categoria, precio, descripcion)
        VALUES (${nombre}, ${categoria}, ${precio || 0}, ${descripcion || ''})
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'PUT') {
      const { id, nombre, categoria, precio, descripcion } = req.body || {};
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`
        UPDATE servicios SET
          nombre = ${nombre},
          categoria = ${categoria},
          precio = ${precio || 0},
          descripcion = ${descripcion || ''}
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`UPDATE servicios SET activo = FALSE WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
