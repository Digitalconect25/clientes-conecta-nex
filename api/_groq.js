// Helper para llamar a Groq (modelos Llama gratis con tier muy generoso).
// Necesita GROQ_API_KEY en variables de entorno.
// Si no esta configurada, todos los endpoints de IA fallan con un mensaje claro.
//
// Modelo por defecto: llama-3.3-70b-versatile (mejor calidad)
// Limite gratis: 14400 peticiones al dia, 30 por minuto.

export function iaHabilitada() {
  return !!process.env.GROQ_API_KEY;
}

const MODELO_POR_DEFECTO = 'llama-3.3-70b-versatile';
const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';

// Llama al modelo y devuelve el texto generado.
// `mensajes` es un array de { role, content } estilo OpenAI.
// Lanza error si la API responde mal o no hay key.
export async function llamarIA({ mensajes, modelo, temperatura, max_tokens, timeout_ms }) {
  if (!iaHabilitada()) {
    throw new Error('IA no configurada. Anade GROQ_API_KEY en Vercel.');
  }
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    throw new Error('Mensajes vacios');
  }

  const body = {
    model: modelo || MODELO_POR_DEFECTO,
    messages: mensajes,
    temperature: typeof temperatura === 'number' ? temperatura : 0.7,
    max_tokens: max_tokens || 1500,
    stream: false,
  };

  // Timeout duro: sin el, un fetch colgado consume todo el presupuesto de la
  // funcion serverless (maxDuration) hasta que Vercel la mata con 504.
  const res = await fetch(URL_GROQ, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(typeof timeout_ms === 'number' ? timeout_ms : 30000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const mensaje = err?.error?.message || res.statusText;
    throw new Error('Groq error: ' + mensaje);
  }

  const data = await res.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (!texto) {
    throw new Error('Respuesta vacia de Groq');
  }
  return {
    texto: texto.trim(),
    modelo_usado: data.model,
    tokens_entrada: data?.usage?.prompt_tokens || 0,
    tokens_salida: data?.usage?.completion_tokens || 0,
  };
}
