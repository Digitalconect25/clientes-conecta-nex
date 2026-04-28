import { jsonResponse } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return jsonResponse(res, 500, { error: 'APP_PASSWORD no configurada en servidor' });
  }

  const { password } = req.body || {};
  if (password === expected) {
    return jsonResponse(res, 200, { ok: true });
  }
  return jsonResponse(res, 401, { error: 'Password incorrecta' });
}
