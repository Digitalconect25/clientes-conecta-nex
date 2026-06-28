// Genera un documento legal en el SERVIDOR (reusa src/lib/contratos.js, que es
// JS puro y seguro fuera del navegador) y lo envia al cliente para firma remota.
import crypto from 'node:crypto';
import { sql } from './_db.js';
import { enviarEmail, emailHabilitado } from './_email.js';
import { envolverEmail, botonEmail, escEmail } from './_emailLayout.js';
import { asegurarColumnas as asegurarFirmaCols } from './documentos.js';
import { generarPorTipo } from '../src/lib/contratos.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://clientes.conectanex.com';
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Genera el documento 'tipo' para el cliente, lo guarda y lo envia a firmar.
// faltaDoc=true -> el email recuerda que adjunte su documento de identidad al firmar.
export async function generarYenviarFirma(clienteId, tipo, nombreDoc, faltaDoc = false) {
  await asegurarFirmaCols();
  const [c] = await sql`SELECT * FROM clientes WHERE id = ${clienteId}`;
  if (!c) throw new Error('Cliente no encontrado');
  const [e] = await sql`SELECT * FROM emisor WHERE id = 1`;
  const html = generarPorTipo(tipo, c, e || {}, ''); // firmaURL vacia -> se firma en remoto
  const tok = crypto.randomBytes(24).toString('base64url');
  const email = String(c.email || '').trim();
  const [doc] = await sql`
    INSERT INTO documentos (cliente_id, tipo, nombre, contenido_html, firma_token, firmante_email, firma_estado, firma_enviada_en)
    VALUES (${clienteId}, ${tipo}, ${nombreDoc}, ${html}, ${tok}, ${email}, 'enviado', NOW())
    RETURNING id`;
  const url = `${BASE}/firmar/${tok}`;
  if (email && RE_EMAIL.test(email) && emailHabilitado()) {
    const cuerpo = `
      <p style="margin:0 0 14px">Hola ${escEmail(c.nombre || '')},</p>
      <p style="margin:0 0 16px">Ya tenemos tus datos, ¡gracias! Te enviamos tu <b>${escEmail(nombreDoc)}</b> para que lo revises y, si estás de acuerdo, lo firmes online:</p>
      ${botonEmail(url, 'Ver y firmar el documento')}
      ${faltaDoc ? `<p style="margin:16px 0 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;font-size:14px"><b>Falta tu documento de identidad.</b> Para completar el contrato, adjunta una copia de tu <b>DNI, NIE, Pasaporte o CIF</b> en la misma página, junto al botón de firmar.</p>` : ''}
      <p style="margin:14px 0 0;color:#707a83;font-size:13.5px">Al firmar quedará registrada la fecha y hora. Si tienes cualquier duda, responde a este correo.</p>
      <p style="margin:18px 0 0">Un saludo,<br><b>Equipo Conecta NEX</b></p>`;
    await enviarEmail({
      to: email,
      subject: `Firma tu ${nombreDoc} · Conecta NEX`,
      html: envolverEmail({ titulo: 'Documento para firmar', preheader: `${nombreDoc} listo para tu firma`, cuerpoHtml: cuerpo }),
      replyTo: process.env.REPLY_TO_EMAIL,
    });
  }
  return { id: doc.id, url, token: tok };
}
