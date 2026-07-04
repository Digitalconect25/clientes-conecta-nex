// Publicacion de contenido en WordPress via Royal MCP (REST legacy).
// Config en variables de entorno de Vercel (NUNCA en el codigo):
//   ROYAL_MCP_BASE_URL   -> p. ej. https://conectanex.com/wp-json/royal-mcp/v1
//   ROYAL_MCP_API_KEY    -> la API key (secreta) que va en la cabecera X-Royal-MCP-API-Key
//   ROYAL_MCP_HEADER     -> (opcional) nombre de la cabecera; por defecto X-Royal-MCP-API-Key
//
// La API de Royal MCP replica la REST de WordPress (POST /posts con title/content/
// status/slug/excerpt). Enviamos los campos estandar; los que no soporte se ignoran.

const BASE = (process.env.ROYAL_MCP_BASE_URL || 'https://conectanex.com/wp-json/royal-mcp/v1').replace(/\/+$/, '');
const HEADER = process.env.ROYAL_MCP_HEADER || 'X-Royal-MCP-API-Key';

export function wpHabilitado() {
  return !!process.env.ROYAL_MCP_API_KEY;
}

function headers() {
  return { 'Content-Type': 'application/json', [HEADER]: process.env.ROYAL_MCP_API_KEY };
}

// Crea (o programa) una entrada. Devuelve { id, url }. Lanza con mensaje claro si falla.
// estado: 'publish' (publicar ya) | 'draft' (borrador en WP) | 'future' (programada, con fecha).
export async function publicarPostWP({ titulo, contenido, slug, extracto, estado = 'publish', fecha, categorias, etiquetas }) {
  if (!wpHabilitado()) throw new Error('WordPress no configurado. Anade ROYAL_MCP_API_KEY (y ROYAL_MCP_BASE_URL) en Vercel.');
  if (!titulo || !contenido) throw new Error('Faltan titulo o contenido del articulo.');
  const body = {
    title: titulo,
    content: contenido,
    status: estado,
    slug: slug || undefined,
    excerpt: extracto || undefined,
    date: estado === 'future' ? (fecha || undefined) : undefined,
    // Royal MCP / WP pueden aceptar categorias/etiquetas por nombre; si no, se ignoran.
    categories: Array.isArray(categorias) && categorias.length ? categorias : undefined,
    tags: Array.isArray(etiquetas) && etiquetas.length ? etiquetas : undefined,
  };
  let r;
  try {
    r = await fetch(`${BASE}/posts`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  } catch (e) {
    throw new Error('No se pudo conectar con WordPress: ' + e.message);
  }
  const txt = await r.text();
  let data = null;
  try { data = JSON.parse(txt); } catch { /* respuesta no-JSON */ }
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || txt.slice(0, 300) || ('HTTP ' + r.status);
    throw new Error('WordPress rechazo la publicacion (HTTP ' + r.status + '): ' + msg);
  }
  const id = data && (data.id || data.ID || data.post_id);
  const url = data && (data.link || data.url || data.guid?.rendered || data.permalink);
  return { id: id || null, url: url || '', raw: data };
}

// Comprueba la conexion leyendo una entrada (GET /posts?per_page=1). Devuelve {ok, detalle}.
export async function testConexionWP() {
  if (!wpHabilitado()) return { ok: false, detalle: 'Falta ROYAL_MCP_API_KEY en el servidor.' };
  try {
    const r = await fetch(`${BASE}/posts?per_page=1`, { headers: headers(), signal: AbortSignal.timeout(15000) });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, detalle: 'HTTP ' + r.status + ': ' + t.slice(0, 200) };
    }
    return { ok: true, detalle: 'Conexion con WordPress correcta.' };
  } catch (e) {
    return { ok: false, detalle: 'No se pudo conectar: ' + e.message };
  }
}
