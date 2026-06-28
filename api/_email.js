// Envio de email via Resend usando fetch nativo (sin dependencias).
// Requiere RESEND_API_KEY y RESEND_FROM_EMAIL en variables de entorno.
// Si no estan configuradas, devuelve un error claro.

export function emailHabilitado() {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function enviarEmail({ to, cc, subject, html, attachments, replyTo }) {
  if (!emailHabilitado()) {
    throw new Error('Email no configurado. Anade RESEND_API_KEY y RESEND_FROM_EMAIL en Vercel.');
  }
  // Remitente con NOMBRE visible ("Conecta NEX <...>") para que no salga "info".
  const fromRaw = process.env.RESEND_FROM_EMAIL || '';
  const fromName = process.env.RESEND_FROM_NAME || 'Conecta NEX';
  const from = fromRaw.includes('<') ? fromRaw : `${fromName} <${fromRaw}>`;
  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  // Reply-To: a donde van las RESPUESTAS (p.ej. tu Gmail). Por defecto, REPLY_TO_EMAIL.
  const rt = replyTo || process.env.REPLY_TO_EMAIL;
  if (rt) {
    body.reply_to = Array.isArray(rt) ? rt : [rt];
  }
  if (cc) {
    body.cc = Array.isArray(cc) ? cc : [cc];
  }
  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Resend error: ' + (err.message || res.statusText));
  }
  return res.json();
}
