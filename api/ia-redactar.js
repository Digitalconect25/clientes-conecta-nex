import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';

// Devuelve el contexto del cliente para meter dentro del prompt.
// Solo info no sensible: nombre, contrato, servicios, total, fechas.
async function contextoCliente(clienteId) {
  if (!clienteId) return null;
  const [c] = await sql`SELECT * FROM clientes WHERE id = ${clienteId}`;
  if (!c) return null;
  const servicios = (c.servicios_json || []).map(s => s.nombre).filter(Boolean).join(', ');
  return {
    nombre: c.nombre,
    contacto: c.contacto || '',
    numero_contrato: c.numero_contrato || c.numero_cliente || '',
    servicios,
    total: c.total ? Number(c.total).toFixed(2) + ' EUR' : '',
    estado_proyecto: c.estado_proyecto || '',
    porcentaje_avance: c.porcentaje_avance || 0,
  };
}

const SISTEMA_REDACTAR = `Eres el asistente de redaccion de emails de Conecta Nex, una agencia digital de Alicante (Espana). El emisor es Lazaro Carrazana, profesional autonomo, dueno de la agencia.

Reglas para los emails que redactes:
- Espanol de Espana, registro profesional pero cercano y humano.
- NUNCA uses guion largo (em-dash). Usa guion corto (-) o comas.
- NO uses emojis salvo que el usuario los pida.
- Frases cortas y medianas mezcladas. Sin formulas pomposas.
- Evita "no dudes en contactarnos", "quedo a tu disposicion", "es un placer", "esperamos que..." y otras formulas vacias.
- Verbos directos: "te confirmo", "necesito", "te paso", "quedamos en".
- Estructura limpia: saludo breve, contexto en una linea, accion concreta, cierre corto.
- Si hay datos del cliente, uselos (nombre, servicios contratados, contrato, total).
- Devuelve SOLO el cuerpo HTML del email, sin asunto y sin <html>/<body>. Usa <p>, <ul>, <strong> con moderacion.
- NO inventes datos que no esten en el contexto. Si falta algo, pon un placeholder tipo {{importe}} o "[completar]".`;

const SISTEMA_MEJORAR = `Eres el editor de emails de Conecta Nex. El usuario te pasa un borrador y tu tarea es pulirlo manteniendo su intencion original.

Reglas:
- Espanol de Espana, registro profesional cercano. Voz del emisor (Lazaro, autonomo).
- NUNCA uses guion largo (em-dash). Usa guion corto (-) o comas.
- Corrige ortografia y acentos.
- Acorta donde sobre, no anadas relleno.
- Quita formulas vacias ("no dudes en", "quedo a tu disposicion", "es un placer", etc.).
- NO inventes informacion nueva. Si el borrador no menciona algo, no lo metas.
- Mantiene el formato HTML existente. Si el borrador es texto plano, devuelvelo en <p> simples.
- Devuelve SOLO el cuerpo HTML mejorado, sin explicar los cambios.`;

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  if (req.method === 'GET') {
    return jsonResponse(res, 200, { habilitado: iaHabilitada() });
  }

  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { accion, instruccion, borrador, cliente_id } = req.body || {};

    if (!accion || (accion !== 'redactar' && accion !== 'mejorar')) {
      return jsonResponse(res, 400, { error: 'accion debe ser "redactar" o "mejorar"' });
    }

    const ctx = await contextoCliente(cliente_id);

    let mensajes;
    if (accion === 'redactar') {
      if (!instruccion || !instruccion.trim()) {
        return jsonResponse(res, 400, { error: 'Falta la instruccion de que quieres decir' });
      }
      const ctxTxt = ctx ? `\n\nDatos del cliente para personalizar:\n- Nombre: ${ctx.nombre}\n- Persona de contacto: ${ctx.contacto || '(sin contacto)'}\n- Numero de contrato: ${ctx.numero_contrato || '(sin contrato)'}\n- Servicios contratados: ${ctx.servicios || '(ninguno)'}\n- Total: ${ctx.total || '(sin total)'}\n- Estado del proyecto: ${ctx.estado_proyecto}\n- Avance: ${ctx.porcentaje_avance}%` : '';
      mensajes = [
        { role: 'system', content: SISTEMA_REDACTAR },
        { role: 'user', content: `Redacta un email para mi cliente. Lo que quiero decirle: ${instruccion.trim()}${ctxTxt}` },
      ];
    } else {
      // mejorar
      if (!borrador || !borrador.trim()) {
        return jsonResponse(res, 400, { error: 'Falta el borrador a mejorar' });
      }
      mensajes = [
        { role: 'system', content: SISTEMA_MEJORAR },
        { role: 'user', content: `Pule este borrador:\n\n${borrador.trim()}` },
      ];
    }

    const resultado = await llamarIA({ mensajes, temperatura: accion === 'mejorar' ? 0.4 : 0.7 });
    return jsonResponse(res, 200, {
      cuerpo_html: resultado.texto,
      modelo: resultado.modelo_usado,
      tokens: resultado.tokens_entrada + resultado.tokens_salida,
    });
  } catch (err) {
    console.error('Error IA:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
