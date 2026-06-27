// WhatsApp para recordatorios de cita.
// Modo por defecto (gratis, sin configurar nada): enlace wa.me de 1 clic.
//   La agencia abre el enlace y envia el recordatorio desde su WhatsApp.
// Modo automatico (opcional, futuro): WhatsApp Cloud API de Meta. Se activa
//   solo si defines WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (+ WHATSAPP_TEMPLATE).

// Normaliza un telefono a formato internacional SIN '+' (lo que pide wa.me).
// Por defecto asume Espana (34) para numeros nacionales de 9 digitos.
export function normalizarTelefono(tel, prefijoPais = '34') {
  let s = String(tel || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.length === 9) s = prefijoPais + s; // movil/fijo ES sin prefijo
  return s.replace(/\D/g, '');
}

// Devuelve el enlace wa.me con el mensaje ya escrito (o '' si no hay telefono).
export function waLink(tel, texto) {
  const n = normalizarTelefono(tel);
  if (!n) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(texto || '')}`;
}

export function whatsappCloudHabilitado() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

// Envio automatico por Cloud API (inerte hasta que configures las variables).
// OJO Meta: para escribir a alguien fuera de la ventana de 24 h hace falta una
// PLANTILLA de utilidad aprobada (WHATSAPP_TEMPLATE). Devuelve {ok, ...}.
export async function enviarWhatsAppCloud({ to, texto, plantillaParams }) {
  if (!whatsappCloudHabilitado()) return { ok: false, motivo: 'cloud_no_config' };
  const n = normalizarTelefono(to);
  if (!n) return { ok: false, motivo: 'sin_telefono' };
  const plantilla = process.env.WHATSAPP_TEMPLATE;
  const body = plantilla
    ? {
        messaging_product: 'whatsapp', to: n, type: 'template',
        template: {
          name: plantilla,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'es_ES' },
          ...(plantillaParams && plantillaParams.length
            ? { components: [{ type: 'body', parameters: plantillaParams.map((t) => ({ type: 'text', text: String(t) })) }] }
            : {}),
        },
      }
    : { messaging_product: 'whatsapp', to: n, type: 'text', text: { body: String(texto || '') } };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data } : { ok: false, motivo: data?.error?.message || r.statusText };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}
