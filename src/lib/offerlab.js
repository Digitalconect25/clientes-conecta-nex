// Calculos de Offer Lab, portados de ~/smart-offer-lab/src/types.ts.
//
// Ojo con los nombres de campo: la app local guardaba en el navegador con
// `precioNormal` / `precioDescuento` / `descuentoMax` / `bestSeller`. Aqui los
// datos viven en Neon (tabla diseno_oferta, items_json) con los nombres que ya
// usan api/diseno.js y api/propuestas.js: `precio`, `precio_oferta`,
// `descuento_max`, `best_seller`. Se respeta el esquema de la base de datos;
// lo que se reproduce fielmente es la herramienta, no el nombre de la columna.

// Todos los calculos toleran basura: un campo vaciado a mano llega como NaN.
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : Number.isFinite(Number(n)) ? Number(n) : 0);

const eurRedondo = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const eurConCentimos = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Sin centimos cuando es redondo: "2.900 €" se lee mejor que "2.900,00 €". */
export function money(n) {
  const v = num(n);
  return Number.isInteger(v) ? eurRedondo.format(v) : eurConCentimos.format(v);
}

export function pct(n) {
  return `${(Math.round(num(n) * 10) / 10).toString().replace('.', ',')} %`;
}

export function fechaLarga(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function nuevoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function totalPlazos(p) {
  return num(p?.numero) * num(p?.monto);
}

/** Lo que el cliente paga de verdad por ese elemento. */
export function precioVenta(item) {
  return num(item?.precio_oferta) > 0 ? num(item.precio_oferta) : num(item?.precio);
}

/** Suelo de precio segun el descuento maximo que se ha fijado. */
export function precioSuelo(item) {
  return num(item?.precio) * (1 - num(item?.descuento_max) / 100);
}

/** Descuento real que se esta aplicando, en %. */
export function descuentoReal(item) {
  const normal = num(item?.precio);
  if (normal <= 0) return 0;
  return ((normal - num(item?.precio_oferta)) / normal) * 100;
}

export function resumen(items) {
  const lista = Array.isArray(items) ? items : [];
  const valorTotal = lista.reduce((t, i) => t + num(i.precio), 0);
  const precioOferta = lista.reduce((t, i) => t + precioVenta(i), 0);
  const ahorro = valorTotal - precioOferta;
  return {
    elementos: lista.length,
    valorTotal,
    precioOferta,
    ahorro,
    ahorroPct: valorTotal > 0 ? (ahorro / valorTotal) * 100 : 0,
  };
}

/** Elemento nuevo con los valores de partida de la app original. */
export function nuevoItem(nombre) {
  return {
    id: nuevoId(),
    nombre: String(nombre || '').trim(),
    precio: 0,
    precio_oferta: 0,
    descuento_max: 20,
    plazos: { numero: 0, monto: 0 },
    columna: 'sin-asignar',
    best_seller: false,
    puntos: { complementa: 3, objecion: 3, valor: 3, esfuerzo: 3 },
  };
}

export function nuevoAvatar(nombre) {
  return {
    id: nuevoId(),
    nombre: String(nombre || '').trim(),
    dolor_corto: '',
    x: 50,
    y: 50,
    dolor: '',
    sueno: '',
    no: '',
    si: '',
  };
}

/** En que anillo ha quedado. Quien no ve el mapa necesita que se lo digan. */
export function anilloDe(x, y) {
  const radio = Math.hypot(num(x) - 50, num(y) - 50);
  if (radio <= 17) return 'cliente ideal';
  if (radio <= 32) return 'afin';
  return 'lejano';
}
