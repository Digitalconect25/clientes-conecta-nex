import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';

// Catálogo de servicios IA con PRECIOS DE MERCADO 2026 (España, pymes) para una
// agencia joven: tercio bajo-medio del mercado real (análisis con fuentes).
// El "precio" es el SETUP; la cuota mensual va en la descripción. Acción: seed_ia (upsert).
const SERVICIOS_IA = [
  ['Chatbots y asistentes IA', 'Chatbot IA — Básico', 690, 'FAQ automático y atención simple en tu web, sin integraciones. Cuota: desde 79 €/mes. Entrega: 5-7 días.'],
  ['Chatbots y asistentes IA', 'Chatbot IA — Intermedio', 1490, 'IA con tu información, captación de leads, WhatsApp y respuestas contextuales. Cuota: desde 149 €/mes. Entrega: 10-15 días.'],
  ['Chatbots y asistentes IA', 'Chatbot IA — Avanzado', 2990, 'Multicanal (web+WhatsApp), RAG sobre tu documentación, integración con CRM y métricas. Cuota: desde 249 €/mes. Entrega: 20-30 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Básico', 890, 'Atiende llamadas, responde dudas por voz y deriva a WhatsApp. Cuota: desde 99 €/mes (+ consumo de llamadas). Entrega: 7-10 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Intermedio', 1990, 'Cualifica leads, agenda citas (calendario) y transferencia inteligente, 24/7. Cuota: desde 199 €/mes. Entrega: 12-18 días.'],
  ['Recepcionista IA (llamadas)', 'Recepcionista IA — Avanzado', 3990, 'Voz de marca, varios departamentos, integración CRM/ERP y reportes de llamadas. Cuota: desde 349 €/mes. Entrega: 25-35 días.'],
  ['Automatización de procesos', 'Automatización — Básico', 590, '2-4 flujos simples (formularios a CRM, emails, notificaciones, sincronización). Cuota: desde 69 €/mes. Entrega: 3-5 días.'],
  ['Automatización de procesos', 'Automatización — Intermedio', 1790, '5-10 flujos con IA e integraciones (Make/n8n + tus apps). Cuota: desde 149 €/mes. Entrega: 10-15 días.'],
  ['Automatización de procesos', 'Automatización — Avanzado', 3990, '10+ flujos conectados, procesamiento documental y orquestación con IA. Cuota: desde 249 €/mes. Entrega: 20-40 días.'],
  ['Agentes IA a medida', 'Agente IA — Básico', 990, 'Agente de una función entrenado con tus datos (atención, RAG básico). Cuota: desde 99 €/mes. Entrega: 5-8 días.'],
  ['Agentes IA a medida', 'Agente IA — Intermedio', 2990, 'Agente multifunción con memoria, RAG sobre tu documentación e integraciones. Cuota: desde 199 €/mes. Entrega: 12-20 días.'],
  ['Agentes IA a medida', 'Agente IA — Avanzado', 5990, 'Agente sectorial con toma de decisiones, integraciones profundas y panel de gestión. Cuota: desde 349 €/mes. Entrega: 30-50 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Básico', 290, '8-12 piezas/mes en 1 plataforma, calendario editorial y tono de marca. Cuota: desde 249 €/mes. Entrega: 3-5 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Intermedio', 590, 'Multiplataforma, 15-20 piezas/mes, newsletter, copy de anuncios y repurposing. Cuota: desde 449 €/mes. Entrega: 8-12 días.'],
  ['Generación de contenido con IA', 'Contenido IA — Avanzado', 1190, 'Motor completo: blog SEO + redes + email + guiones, con reporting mensual. Cuota: desde 799 €/mes. Entrega: 15-25 días.'],
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
        let insertados = 0, actualizados = 0;
        for (const [categoria, nombre, precio, descripcion] of SERVICIOS_IA) {
          const [ya] = await sql`SELECT id FROM servicios WHERE nombre = ${nombre} LIMIT 1`;
          if (ya) {
            await sql`UPDATE servicios SET categoria = ${categoria}, precio = ${precio}, descripcion = ${descripcion}, activo = TRUE WHERE id = ${ya.id}`;
            actualizados++;
          } else {
            await sql`INSERT INTO servicios (nombre, categoria, precio, descripcion) VALUES (${nombre}, ${categoria}, ${precio}, ${descripcion})`;
            insertados++;
          }
        }
        return jsonResponse(res, 200, { ok: true, insertados, actualizados, total: SERVICIOS_IA.length });
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
