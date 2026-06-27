// Plantilla de email PREMIUM y coherente para los correos de cita.
// Diseño sobrio y editorial (somos una agencia de marketing: el propio correo
// es nuestra carta de presentación). Solo estilos inline + tablas (compatibilidad).

const LOGO = 'https://clientes.conectanex.com/logo-email.png';
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C = {
  ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d',
  crema: '#f7f5ef', linea: '#efe9db', fondo: '#f1efe8',
};

// Escapa texto no confiable (nombre, nota del cliente) antes de meterlo en HTML.
export const escEmail = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Botón principal (centrado, tabla para que se vea bien en todos los clientes).
export function botonEmail(href, texto, color = C.teal) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
    <tr><td style="border-radius:10px;background:${color}">
      <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;font-family:${FUENTE}">${texto}</a>
    </td></tr></table>`;
}

// Tarjeta de datos clave: filas = [[etiqueta, valor], ...] (valor admite HTML).
export function tarjetaDatos(filas) {
  const rows = filas.filter(Boolean).map(([k, v], i) => {
    const top = i ? `border-top:1px solid ${C.linea};` : '';
    return `<tr>
      <td style="padding:11px 16px;${top}color:${C.tenue};font-size:13px;width:36%;vertical-align:top">${k}</td>
      <td style="padding:11px 16px;${top}color:${C.ink};font-weight:600;font-size:14.5px">${v}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};border:1px solid ${C.linea};border-radius:12px;margin:8px 0 4px">${rows}</table>`;
}

// Envoltorio completo del email.
export function envolverEmail({ titulo, preheader = '', cuerpoHtml, logoUrl = LOGO }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.fondo};font-family:${FUENTE}">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escEmail(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo}">
    <tr><td align="center" style="padding:30px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.linea};border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px 18px;text-align:center;border-bottom:1px solid #f2eee3">
          <img src="${logoUrl}" alt="Conecta NEX" width="150" style="max-width:150px;height:auto;display:inline-block">
        </td></tr>
        <tr><td style="padding:30px 32px 0">
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:${C.ink};font-weight:700">${titulo}</h1>
          <div style="height:3px;width:44px;background:${C.teal};border-radius:3px;margin:12px 0 0"></div>
        </td></tr>
        <tr><td style="padding:16px 32px 30px;color:${C.cuerpo};font-size:15.5px;line-height:1.65">
          ${cuerpoHtml}
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #f2eee3;color:#9a9384;font-size:12px;line-height:1.7">
          <b style="color:${C.tenue}">Conecta NEX</b> &middot; Calle Alberola 24, 03007 Alicante<br>
          <a href="https://conectanex.es" style="color:${C.teal};text-decoration:none">conectanex.es</a>
        </td></tr>
      </table>
      <div style="max-width:560px;color:#b3ab9a;font-size:11px;margin:14px auto 0">Marketing y presencia digital para tu negocio</div>
    </td></tr>
  </table>
</body></html>`;
}
