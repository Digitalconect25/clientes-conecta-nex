// Contenido SEO: el agente genera articulos orientados a captar negocios locales
// y los publica en WordPress (conectanex.com) via Royal MCP.
import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { llamarIA, iaHabilitada } from './_groq.js';
import { publicarPostWP, wpHabilitado, testConexionWP } from './_wordpress.js';

export const maxDuration = 60;

// ── Auto-migracion (idempotente, una vez por instancia) ──────────────────────
let _mig = false;
async function ensureC() {
  if (_mig) return;
  let ok = true;
  try {
    await sql`CREATE TABLE IF NOT EXISTS contenidos (
      id SERIAL PRIMARY KEY, tema TEXT DEFAULT '', titulo TEXT DEFAULT '', slug TEXT DEFAULT '',
      meta_desc TEXT DEFAULT '', cuerpo_html TEXT DEFAULT '', etiquetas TEXT DEFAULT '',
      estado TEXT DEFAULT 'borrador', wp_post_id INTEGER, wp_url TEXT DEFAULT '', error TEXT DEFAULT '',
      origen TEXT DEFAULT 'manual', creado_en TIMESTAMPTZ DEFAULT NOW(), publicado_en TIMESTAMPTZ,
      actualizado_en TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE INDEX IF NOT EXISTS idx_contenidos_estado ON contenidos (estado, creado_en DESC)`;
  } catch { ok = false; }
  try {
    await sql`CREATE TABLE IF NOT EXISTS contenido_config (
      id INTEGER PRIMARY KEY DEFAULT 1, activo BOOLEAN DEFAULT FALSE, temas TEXT DEFAULT '',
      tema_idx INTEGER DEFAULT 0, auto_publicar BOOLEAN DEFAULT FALSE, ultima_ejecucion TIMESTAMPTZ,
      ultimo_resultado TEXT DEFAULT '', actualizado_en TIMESTAMPTZ DEFAULT NOW())`;
    await sql`INSERT INTO contenido_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  } catch { ok = false; }
  _mig = ok;
}

async function getConfig() {
  await ensureC();
  const DEF = { id: 1, activo: false, temas: '', tema_idx: 0, auto_publicar: false };
  try {
    let [c] = await sql`SELECT * FROM contenido_config WHERE id = 1`;
    if (!c) { await sql`INSERT INTO contenido_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`; [c] = await sql`SELECT * FROM contenido_config WHERE id = 1`; }
    return c || DEF;
  } catch { return DEF; }
}

const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);

// Limpia el HTML que devuelve la IA (quita script/style/iframe por seguridad).
const limpiarHtml = (h) => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/ on\w+="[^"]*"/gi, '').trim();

// ── Generacion del articulo SEO con IA ───────────────────────────────────────
async function generarArticulo(tema) {
  const sys = `Eres redactor SEO de Conecta Nex (marca de Digital Conect), agencia que ayuda a negocios locales a mejorar su PRESENCIA DIGITAL (aparecer en Google y en la IA, web y ficha de Google al dia, resenas, redes) para que lleguen mas clientes. Escribe un ARTICULO DE BLOG util y honesto para el publico objetivo: duenos de negocios locales (bares, peluquerias, clinicas, talleres, tiendas...). Objetivo: posicionar en Google (SEO) y demostrar autoridad para atraer clientes de forma organica.
REGLAS: espanol de Espana, cercano y practico, sin humo ni promesas irreales, sin emojis, sin guion largo (em-dash). Estructura clara con encabezados <h2> y <h3>, parrafos breves, alguna lista <ul>. Incluye consejos accionables y menciona de forma natural como ayuda una buena presencia digital (sin ser un anuncio; aporta valor primero). 700-1000 palabras. NO inventes datos ni estadisticas concretas. Integra la palabra clave del tema de forma natural en el titulo, el primer parrafo y algun encabezado. NO uses <h1> (el titulo va aparte). NO incluyas <script> ni estilos.
Devuelve EXACTAMENTE este formato:
TITULO: <titulo atractivo y con la keyword, max 65 caracteres>
META: <meta description SEO persuasiva, 140-155 caracteres>
ETIQUETAS: <3-6 etiquetas separadas por comas>
---
<cuerpo del articulo en HTML: varios <h2>/<h3>, <p>, <ul>; sin <h1>>`;
  const user = `Tema / palabra clave del articulo: "${tema}".`;
  const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperatura: 0.6, max_tokens: 2600, timeout_ms: 40000 });
  const campo = (re) => ((texto.match(re) || [])[1] || '').trim();
  let titulo = campo(/TITULO:\s*(.+)/i);
  const meta = campo(/META:\s*(.+)/i);
  const etiquetas = campo(/ETIQUETAS:\s*(.+)/i);
  let cuerpo = texto;
  const idx = texto.indexOf('---');
  if (idx >= 0) cuerpo = texto.slice(idx + 3);
  cuerpo = limpiarHtml(cuerpo.replace(/^\s*-{3,}\s*/, ''));
  if (!titulo) titulo = String(tema).charAt(0).toUpperCase() + String(tema).slice(1);
  return { tema, titulo, slug: slugify(titulo), meta_desc: meta, cuerpo_html: cuerpo, etiquetas };
}

// Guarda un articulo generado como borrador.
async function guardarBorrador(a, origen = 'manual') {
  const [row] = await sql`
    INSERT INTO contenidos (tema, titulo, slug, meta_desc, cuerpo_html, etiquetas, estado, origen)
    VALUES (${a.tema || ''}, ${a.titulo || ''}, ${a.slug || ''}, ${a.meta_desc || ''}, ${a.cuerpo_html || ''}, ${a.etiquetas || ''}, ${'borrador'}, ${origen})
    RETURNING *`;
  return row;
}

// Publica un contenido (por id) en WordPress y actualiza su estado.
async function publicarContenido(c, estadoWp = 'publish') {
  try {
    const r = await publicarPostWP({
      titulo: c.titulo, contenido: c.cuerpo_html, slug: c.slug, extracto: c.meta_desc, estado: estadoWp,
      etiquetas: String(c.etiquetas || '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    const [row] = await sql`UPDATE contenidos SET estado = 'publicado', wp_post_id = ${r.id}, wp_url = ${r.url || ''},
      error = '', publicado_en = NOW(), actualizado_en = NOW() WHERE id = ${c.id} RETURNING *`;
    return { ok: true, contenido: row };
  } catch (e) {
    await sql`UPDATE contenidos SET estado = 'error', error = ${String(e.message).slice(0, 400)}, actualizado_en = NOW() WHERE id = ${c.id}`;
    return { ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  const cronOk = !!(process.env.CRON_SECRET && req.body && req.body.secret === process.env.CRON_SECRET);
  if (!auth.ok && !cronOk) return jsonResponse(res, 401, { error: auth.error });

  try {
    await ensureC();

    if (req.method === 'GET') {
      if (req.query.id) {
        const [row] = await sql`SELECT * FROM contenidos WHERE id = ${req.query.id}`;
        if (!row) return jsonResponse(res, 404, { error: 'No encontrado' });
        return jsonResponse(res, 200, row);
      }
      const rows = await sql`SELECT id, tema, titulo, slug, meta_desc, etiquetas, estado, wp_url, error, origen, creado_en, publicado_en FROM contenidos ORDER BY creado_en DESC LIMIT 200`;
      return jsonResponse(res, 200, { contenidos: rows, ia_habilitada: iaHabilitada(), wp_habilitado: wpHabilitado() });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const accion = b.accion || '';

      if (accion === 'config_get') return jsonResponse(res, 200, await getConfig());
      if (accion === 'config_set') {
        await getConfig();
        const [row] = await sql`UPDATE contenido_config SET
          activo = ${!!b.activo}, temas = ${String(b.temas || '').trim()},
          auto_publicar = ${!!b.auto_publicar}, actualizado_en = NOW() WHERE id = 1 RETURNING *`;
        return jsonResponse(res, 200, row);
      }

      if (accion === 'test_wp') return jsonResponse(res, 200, await testConexionWP());

      // Ideas de temas SEO para captar negocios locales.
      if (accion === 'ideas') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const sys = `Eres estratega SEO de una agencia que ayuda a negocios locales con su presencia digital. Propon 8 ideas de articulos de blog que atraigan a duenos de negocios locales buscando en Google, con intencion util (guias, como-hacer, errores comunes, comparativas). Espanol de Espana, sin emojis. Devuelve SOLO una lista, una idea por linea, sin numeracion ni comillas.`;
        const { texto } = await llamarIA({ mensajes: [{ role: 'system', content: sys }, { role: 'user', content: b.contexto || 'Presencia digital, Google, resenas, web, redes para negocios locales.' }], temperatura: 0.8, max_tokens: 500 });
        const ideas = String(texto).split(/\n+/).map((s) => s.replace(/^[\s\-\d.)*]+/, '').trim()).filter((s) => s.length > 8).slice(0, 8);
        return jsonResponse(res, 200, { ok: true, ideas });
      }

      // Genera un articulo (borrador). Requiere tema.
      if (accion === 'generar') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada (GROQ_API_KEY).' });
        const tema = String(b.tema || '').trim();
        if (!tema) return jsonResponse(res, 400, { error: 'Indica el tema o palabra clave del articulo.' });
        const a = await generarArticulo(tema);
        const row = await guardarBorrador(a, 'manual');
        return jsonResponse(res, 200, { ok: true, contenido: row });
      }

      // Publica un borrador existente en WordPress.
      if (accion === 'publicar') {
        if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
        if (!wpHabilitado()) return jsonResponse(res, 400, { error: 'WordPress no configurado (ROYAL_MCP_API_KEY).' });
        const [c] = await sql`SELECT * FROM contenidos WHERE id = ${b.id}`;
        if (!c) return jsonResponse(res, 404, { error: 'No encontrado' });
        const r = await publicarContenido(c, b.programar ? 'future' : 'publish');
        if (!r.ok) return jsonResponse(res, 502, { error: r.error });
        return jsonResponse(res, 200, { ok: true, contenido: r.contenido });
      }

      // Genera y publica de una vez (por tema).
      if (accion === 'generar_publicar') {
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
        if (!wpHabilitado()) return jsonResponse(res, 400, { error: 'WordPress no configurado (ROYAL_MCP_API_KEY).' });
        const tema = String(b.tema || '').trim();
        if (!tema) return jsonResponse(res, 400, { error: 'Indica el tema.' });
        const a = await generarArticulo(tema);
        const row = await guardarBorrador(a, 'manual');
        const r = await publicarContenido(row, 'publish');
        if (!r.ok) return jsonResponse(res, 502, { error: r.error, contenido_id: row.id });
        return jsonResponse(res, 200, { ok: true, contenido: r.contenido });
      }

      // Ciclo del agente (cron/semana): coge el proximo tema que rota, genera el articulo
      // y lo publica (o lo deja como borrador si auto_publicar=false).
      if (accion === 'ciclo') {
        const cfg = await getConfig();
        if (!cfg.activo && !b.forzar) return jsonResponse(res, 200, { ok: true, saltado: 'agente de contenido desactivado' });
        if (!iaHabilitada()) return jsonResponse(res, 400, { error: 'IA no configurada.' });
        const temas = String(cfg.temas || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        if (!temas.length) return jsonResponse(res, 400, { error: 'Configura al menos un tema/keyword para el blog.' });
        const idx = ((cfg.tema_idx || 0) % temas.length + temas.length) % temas.length;
        const tema = temas[idx];
        let resumen = '', row = null, publicado = false;
        try {
          const a = await generarArticulo(tema);
          row = await guardarBorrador(a, 'agente');
          if (cfg.auto_publicar && wpHabilitado()) {
            const r = await publicarContenido(row, 'publish');
            publicado = r.ok;
            resumen = r.ok ? `Publicado "${row.titulo}" (${tema})` : `Generado "${row.titulo}" pero fallo la publicacion: ${r.error}`;
          } else {
            resumen = `Borrador generado "${row.titulo}" (${tema})${cfg.auto_publicar ? ' — WordPress no configurado' : ' — pendiente de revisar y publicar'}`;
          }
        } catch (e) { resumen = `ERROR con el tema "${tema}": ${e.message}`; }
        // Avanza el tema solo si genero el articulo; si fallo la generacion, reintenta el mismo.
        const siguiente = row ? (cfg.tema_idx || 0) + 1 : (cfg.tema_idx || 0);
        await sql`UPDATE contenido_config SET tema_idx = ${siguiente}, ultima_ejecucion = NOW(), ultimo_resultado = ${resumen.slice(0, 500)}, actualizado_en = NOW() WHERE id = 1`;
        return jsonResponse(res, 200, { ok: true, tema, publicado, contenido: row });
      }

      return jsonResponse(res, 400, { error: 'Accion no valida' });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return jsonResponse(res, 400, { error: 'Falta id' });
      const [row] = await sql`UPDATE contenidos SET
        tema = ${b.tema || ''}, titulo = ${b.titulo || ''}, slug = ${slugify(b.slug || b.titulo || '')},
        meta_desc = ${b.meta_desc || ''}, cuerpo_html = ${limpiarHtml(b.cuerpo_html || '')}, etiquetas = ${b.etiquetas || ''},
        actualizado_en = NOW() WHERE id = ${b.id} RETURNING *`;
      return jsonResponse(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM contenidos WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('contenido:', err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
