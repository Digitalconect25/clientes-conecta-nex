// Envio de email via Resend usando fetch nativo (sin dependencias).
// Requiere RESEND_API_KEY y RESEND_FROM_EMAIL en variables de entorno.
// Si no estan configuradas, devuelve un error claro.

export function emailHabilitado() {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function enviarEmail({ to, subject, html, attachments }) {
  if (!emailHabilitado()) {
    throw new Error('Email no configurado. Anade RESEND_API_KEY y RESEND_FROM_EMAIL en Vercel.');
  }
  const body = {
    from: process.env.RESEND_FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
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
