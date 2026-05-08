// Cifrado AES-256-GCM para guardar contrasenas de accesos del cliente.
// La clave maestra esta en process.env.ACCESS_ENCRYPTION_KEY (64 hex chars).
//
// Para generar una clave nueva en tu terminal:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.ACCESS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ACCESS_ENCRYPTION_KEY no configurada (necesita 64 caracteres hex)');
  }
  return Buffer.from(hex, 'hex');
}

export function cifrar(textoPlano) {
  if (!textoPlano) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function descifrar(textoCifrado) {
  if (!textoCifrado) return '';
  try {
    const key = getKey();
    const buffer = Buffer.from(textoCifrado, 'base64');
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) return '';
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Error descifrando:', err.message);
    return '';
  }
}
