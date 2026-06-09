// Helpers para el contenido de emails recibidos (Resend Inbound).
// El webhook normalmente solo trae metadatos, pero intentamos extraer el cuerpo
// de el por si la configuracion lo incluye; si no, se pide a la API y, como
// ultimo recurso, se descarga el email crudo (raw) y se parsea.

export function decodeMaybe(s) {
  const v = String(s || '');
  const m = v.match(/^data:[^;,]*?(;base64)?,([\s\S]*)$/);
  if (!m) return v;
  try { return m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2]); } catch { return v; }
}

// Intenta sacar text/html del propio payload del webhook, probando todos los
// nombres de campo que distintas configuraciones de Resend/inbound pueden usar.
export function extraerCuerpoDeWebhook(payload) {
  const d = (payload && (payload.data || payload)) || {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = d[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return '';
  };
  const text = pick('text', 'plain', 'text_body', 'textBody', 'body_plain', 'BodyPlain', 'stripped-text');
  const html = pick('html', 'html_body', 'htmlBody', 'body_html', 'BodyHtml', 'stripped-html');
  if (!text && !html) return null;
  return { text: decodeMaybe(text), html: decodeMaybe(html) };
}

// Descarga el email crudo (MIME) desde una URL firmada y extrae text/html.
async function traerDesdeRaw(downloadUrl) {
  try {
    const r = await fetch(downloadUrl);
    if (!r.ok) return null;
    const mime = await r.text();
    // Extraccion sencilla de las partes text/plain y text/html del MIME.
    const grab = (tipo) => {
      const re = new RegExp(`Content-Type:\\s*${tipo}[\\s\\S]*?\\r?\\n\\r?\\n([\\s\\S]*?)(\\r?\\n--|$)`, 'i');
      const m = mime.match(re);
      return m ? m[1].trim() : '';
    };
    const html = grab('text/html');
    const text = grab('text/plain');
    if (!text && !html) return null;
    return { text, html };
  } catch { return null; }
}

// Pide a Resend el email recibido por su id. Devuelve { from, to, subject, text, html } o null.
export async function traerContenidoResend(emailId, reintentos = 1) {
  if (!emailId || !process.env.RESEND_API_KEY) return null;
  for (let i = 0; i <= reintentos; i++) {
    try {
      const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (r.ok) {
        const j = await r.json();
        let text = decodeMaybe(j.text || '');
        let html = decodeMaybe(j.html || '');
        // Si la API no trae cuerpo pero si una URL del email crudo, lo descargamos.
        if (!text && !html && j.raw?.download_url) {
          const raw = await traerDesdeRaw(j.raw.download_url);
          if (raw) { text = raw.text; html = raw.html; }
        }
        if (text || html || j.from || j.subject) {
          return {
            from: typeof j.from === 'string' ? j.from : (j.from?.address || ''),
            to: Array.isArray(j.to) ? j.to[0] : j.to,
            subject: j.subject || '',
            text,
            html,
          };
        }
      } else if (r.status !== 404 && r.status !== 425) {
        return null; // error real (no es "aun no listo")
      }
    } catch { return null; }
    if (i < reintentos) await new Promise((s) => setTimeout(s, 1500));
  }
  return null; // aun no disponible
}
