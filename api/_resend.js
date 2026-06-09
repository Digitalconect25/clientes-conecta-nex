// Helpers para el contenido de emails recibidos (Resend Inbound).
// El webhook solo trae metadatos; el cuerpo se pide aparte y puede tardar
// unos segundos en estar disponible (de ahi el fetch diferido al abrir la Bandeja).

export function decodeMaybe(s) {
  const v = String(s || '');
  const m = v.match(/^data:[^;,]*?(;base64)?,([\s\S]*)$/);
  if (!m) return v;
  try { return m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2]); } catch { return v; }
}

// Pide a Resend el email recibido por su id. Devuelve { from, subject, text, html } o null.
export async function traerContenidoResend(emailId, reintentos = 1) {
  if (!emailId || !process.env.RESEND_API_KEY) return null;
  for (let i = 0; i <= reintentos; i++) {
    try {
      const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (r.ok) {
        const j = await r.json();
        if (j && (j.text || j.html)) {
          return {
            from: typeof j.from === 'string' ? j.from : (j.from?.address || ''),
            to: Array.isArray(j.to) ? j.to[0] : j.to,
            subject: j.subject || '',
            text: decodeMaybe(j.text || ''),
            html: decodeMaybe(j.html || ''),
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
