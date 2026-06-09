// Verificacion temporal de la clave de recepcion. Borrar tras usar.
import { traerContenidoResend } from './_resend.js';
import { jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  if (req.query.token !== 'diag123') return jsonResponse(res, 401, { error: 'no auth' });
  const id = req.query.id || '0866ec52-1302-4abd-9750-e3d7f664ccd2';
  const out = {
    tieneClaveRecepcion: !!process.env.RESEND_RECEIVING_API_KEY,
    recEmpieza: process.env.RESEND_RECEIVING_API_KEY ? process.env.RESEND_RECEIVING_API_KEY.slice(0, 7) : null,
    envioEmpieza: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.slice(0, 7) : null,
  };
  const full = await traerContenidoResend(id, 0);
  out.id = id;
  out.encontrado = !!full;
  if (full) {
    out.from = full.from;
    out.subject = full.subject;
    out.textoLen = (full.text || '').length;
    out.htmlLen = (full.html || '').length;
    out.muestra = (full.text || full.html || '').slice(0, 200);
  }
  return jsonResponse(res, 200, out);
}
