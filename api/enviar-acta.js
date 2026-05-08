import { checkAuth, jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  if (req.method === 'GET') {
    return jsonResponse(res, 200, { habilitado: emailHabilitado() });
  }

  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  try {
    const { destinatario, asunto, mensaje_html, pdf_base64, pdf_nombre } = req.body || {};
    if (!destinatario) return jsonResponse(res, 400, { error: 'Falta destinatario' });

    const attachments = pdf_base64 ? [{
      filename: pdf_nombre || 'acta-de-entrega.pdf',
      content: pdf_base64,
    }] : [];

    const resultado = await enviarEmail({
      to: destinatario,
      subject: asunto || 'Acta de entrega de tu proyecto - Conecta Nex',
      html: mensaje_html || '<p>Adjunto encontraras el acta de entrega de tu proyecto.</p>',
      attachments,
    });

    return jsonResponse(res, 200, { ok: true, id: resultado.id });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
