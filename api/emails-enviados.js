import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { enviarEmail, emailHabilitado } from './_email.js';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

// Sustituye variables {{xxx}} en el texto con valores reales del cliente y emisor.
function aplicarVariables(texto, cliente, emisor) {
  if (!texto) return '';
  const fechaHoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const reemplazos = {
    cliente_nombre: cliente?.nombre || '',
    cliente_email: cliente?.email || '',
    cliente_nif: cliente?.nif || '',
    cliente_telefono: cliente?.telefono || '',
    cliente_numero: cliente?.numero_cliente || '',
    numero_cliente: cliente?.numero_cliente || '',
    numero_contrato: cliente?.numero_contrato || cliente?.numero_cliente || '',
    cliente_total: cliente?.total ? Number(cliente.total).toFixed(2) + ' EUR' : '',
    total: cliente?.total ? Number(cliente.total).toFixed(2) + ' EUR' : '',
    cliente_direccion: cliente?.direccion || '',
    cliente_ciudad: cliente?.ciudad || '',
    emisor_nombre: emisor?.nombre || '',
    emisor_nombre_comercial: emisor?.nombre_comercial || '',
    emisor_email: emisor?.email || '',
    emisor_telefono: emisor?.telefono || '',
    emisor_web: emisor?.web || '',
    emisor_nif: emisor?.nif || '',
    fecha_hoy: fechaHoy,
    anio: new Date().getFullYear(),
  };
  let resultado = texto;
  Object.keys(reemplazos).forEach(k => {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    resultado = resultado.replace(re, reemplazos[k]);
  });
  return resultado;
}

// Envuelve el cuerpo HTML en una plantilla con cabecera y pie con branding.
function envolverConBranding(cuerpoHtml, emisor) {
  const color = emisor?.color_principal || '#047857';
  const logo = emisor?.logo_url
    ? `<img src="${emisor.logo_url}" alt="${emisor.nombre_comercial || emisor.nombre}" style="max-height: 50px; max-width: 200px;" />`
    : `<h1 style="color: ${color}; margin: 0; font-size: 24px;">${emisor?.nombre_comercial || emisor?.nombre || 'Conecta Nex'}</h1>`;

  const direccion = [emisor?.direccion, emisor?.cp, emisor?.ciudad].filter(Boolean).join(', ');
  const firmaEmail = emisor?.firma_email || `${emisor?.nombre || ''}${emisor?.email ? ' &middot; ' + emisor.email : ''}${emisor?.telefono ? ' &middot; ' + emisor.telefono : ''}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${emisor?.nombre_comercial || 'Conecta Nex'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f9fafb; color: #1a1a1a; line-height: 1.6;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb;">
  <tr>
    <td align="center" style="padding: 30px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

        <!-- Cabecera -->
        <tr>
          <td style="background: ${color}; padding: 24px 30px; text-align: center;">
            <div style="color: #fff;">${logo}</div>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding: 30px;">
            ${cuerpoHtml}
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
              ${firmaEmail}
            </p>
            ${direccion ? `<p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">${direccion}</p>` : ''}
          </td>
        </tr>

      </table>
      <p style="font-size: 11px; color: #9ca3af; margin: 16px 0 0; text-align: center;">
        Si tienes dudas, puedes responder directamente a este email.
      </p>
    </td>
  </tr>
</table>

</body>
</html>`;
}

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  try {
    if (req.method === 'GET') {
      // Listado de emails enviados por cliente o globales
      const clienteId = req.query.cliente_id ? parseInt(req.query.cliente_id, 10) : null;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

      let rows;
      if (clienteId) {
        rows = await sql`
          SELECT id, cliente_id, plantilla_id, destinatario, cc, asunto,
                 archivos_adjuntos, exitoso, error, enviado_en
          FROM emails_enviados
          WHERE cliente_id = ${clienteId}
          ORDER BY enviado_en DESC
          LIMIT ${limit}
        `;
      } else {
        rows = await sql`
          SELECT e.id, e.cliente_id, e.plantilla_id, e.destinatario, e.cc, e.asunto,
                 e.archivos_adjuntos, e.exitoso, e.error, e.enviado_en,
                 c.nombre AS cliente_nombre
          FROM emails_enviados e
          LEFT JOIN clientes c ON c.id = e.cliente_id
          ORDER BY e.enviado_en DESC
          LIMIT ${limit}
        `;
      }
      return jsonResponse(res, 200, rows);
    }

    if (req.method === 'POST') {
      const {
        cliente_id, plantilla_id, destinatario, cc,
        asunto, cuerpo_html, archivos_ids, archivos_extras,
      } = req.body || {};

      if (!destinatario) {
        return jsonResponse(res, 400, { error: 'Falta destinatario' });
      }
      if (!asunto || !cuerpo_html) {
        return jsonResponse(res, 400, { error: 'Faltan asunto o cuerpo' });
      }

      if (!emailHabilitado()) {
        return jsonResponse(res, 503, {
          error: 'Email no configurado en Vercel. Anade RESEND_API_KEY y RESEND_FROM_EMAIL.',
        });
      }

      // Cargar cliente y emisor para variables
      let cliente = null;
      if (cliente_id) {
        const [c] = await sql`SELECT * FROM clientes WHERE id = ${cliente_id}`;
        cliente = c;
      }
      const [emisor] = await sql`SELECT * FROM emisor WHERE id = 1`;

      // Aplicar variables
      const asuntoFinal = aplicarVariables(asunto, cliente, emisor);
      const cuerpoFinal = aplicarVariables(cuerpo_html, cliente, emisor);
      const cuerpoConBranding = envolverConBranding(cuerpoFinal, emisor);

      // Cargar archivos adjuntos
      const adjuntos = [];
      const adjuntosMeta = [];

      // Archivos del cliente seleccionados
      if (Array.isArray(archivos_ids) && archivos_ids.length > 0) {
        const ids = archivos_ids.map(x => parseInt(x, 10)).filter(Boolean);
        if (ids.length > 0) {
          const filas = await sql`
            SELECT id, nombre, tipo, tamano, contenido FROM archivos
            WHERE id = ANY(${ids})
          `;
          filas.forEach(f => {
            adjuntos.push({
              filename: f.nombre,
              content: Buffer.from(f.contenido).toString('base64'),
            });
            adjuntosMeta.push({ id: f.id, nombre: f.nombre, tipo: f.tipo, tamano: f.tamano });
          });
        }
      }

      // Archivos adjuntos extra subidos al vuelo (no se guardan en BD)
      // Vienen como [{nombre, tipo, contenido_base64}]
      if (Array.isArray(archivos_extras)) {
        archivos_extras.forEach(a => {
          if (a.nombre && a.contenido_base64) {
            adjuntos.push({
              filename: a.nombre,
              content: a.contenido_base64,
            });
            adjuntosMeta.push({
              nombre: a.nombre,
              tipo: a.tipo || 'application/octet-stream',
              tamano: Math.round((a.contenido_base64.length * 3) / 4),
            });
          }
        });
      }

      // Enviar email
      let exitoso = false;
      let resendId = null;
      let errorMsg = null;
      try {
        const r = await enviarEmail({
          to: destinatario,
          cc: cc ? (Array.isArray(cc) ? cc : cc.split(',').map(x => x.trim()).filter(Boolean)) : undefined,
          subject: asuntoFinal,
          html: cuerpoConBranding,
          attachments: adjuntos.length > 0 ? adjuntos : undefined,
        });
        exitoso = true;
        resendId = r?.id || null;
      } catch (err) {
        errorMsg = err.message || 'Error desconocido';
      }

      // Registrar en historial
      const [registro] = await sql`
        INSERT INTO emails_enviados (
          cliente_id, plantilla_id, destinatario, cc, asunto,
          cuerpo_html, archivos_adjuntos, exitoso, resend_id, error
        ) VALUES (
          ${cliente_id || null}, ${plantilla_id || null}, ${destinatario},
          ${cc || ''}, ${asuntoFinal}, ${cuerpoConBranding},
          ${JSON.stringify(adjuntosMeta)}::jsonb,
          ${exitoso}, ${resendId}, ${errorMsg}
        ) RETURNING id, exitoso, error, enviado_en
      `;

      if (!exitoso) {
        return jsonResponse(res, 500, {
          error: errorMsg,
          registro_id: registro.id,
        });
      }
      return jsonResponse(res, 200, {
        ok: true,
        registro_id: registro.id,
        resend_id: resendId,
      });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return jsonResponse(res, 400, { error: 'Falta id' });
      await sql`DELETE FROM emails_enviados WHERE id = ${id}`;
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
