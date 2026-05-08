import { sql } from './_db.js';
import { checkAuth, jsonResponse } from './_auth.js';
import { construirFasesDesdeCategorias } from './_plantillas.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return jsonResponse(res, 401, { error: auth.error });

  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { cliente_id, sustituir } = req.body || {};
    if (!cliente_id) return jsonResponse(res, 400, { error: 'Falta cliente_id' });

    // Carga el cliente para sacar las categorias de sus servicios
    const [cliente] = await sql`SELECT id, servicios_json FROM clientes WHERE id = ${cliente_id}`;
    if (!cliente) return jsonResponse(res, 404, { error: 'Cliente no encontrado' });

    const servicios = Array.isArray(cliente.servicios_json) ? cliente.servicios_json : [];
    if (servicios.length === 0) {
      return jsonResponse(res, 400, { error: 'El cliente no tiene servicios contratados. Anade servicios primero.' });
    }

    // Resolvemos categoria de cada servicio consultando la tabla servicios
    const nombres = servicios.map((s) => s.nombre).filter(Boolean);
    const cats = [];
    if (nombres.length > 0) {
      const filas = await sql`SELECT nombre, categoria FROM servicios WHERE nombre = ANY(${nombres})`;
      const mapa = new Map(filas.map((r) => [r.nombre, r.categoria]));
      nombres.forEach((n) => {
        const cat = mapa.get(n) || 'Otros';
        if (!cats.includes(cat)) cats.push(cat);
      });
    }

    const fases = construirFasesDesdeCategorias(cats);

    if (sustituir) {
      await sql`DELETE FROM fases WHERE cliente_id = ${cliente_id}`;
    }

    const insertadas = [];
    for (const f of fases) {
      const [row] = await sql`
        INSERT INTO fases (cliente_id, orden, nombre, peso, estado)
        VALUES (${cliente_id}, ${f.orden}, ${f.nombre}, ${f.peso}, 'Pendiente')
        RETURNING *
      `;
      insertadas.push(row);
    }

    return jsonResponse(res, 200, { fases: insertadas, categorias: cats });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: err.message });
  }
}
