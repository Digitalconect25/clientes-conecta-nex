// Extrae los colores dominantes de una imagen (logo del cliente).
// Devuelve hasta 4 colores hex, filtrando blancos/negros/grises neutros.

export async function extractPalette(imageSrc, maxColors = 4) {
  const img = await loadImage(imageSrc);

  const SIZE = 100;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  // Bucket por color cuantizado (agrupa colores cercanos)
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    if (isNeutral(r, g, b)) continue;
    const key = `${quant(r)}_${quant(g)}_${quant(b)}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.count++;
      prev.r += r;
      prev.g += g;
      prev.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const result = [];
  for (const bucket of sorted) {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    const hex = toHex(r, g, b);
    // Evita meter colores casi identicos al ultimo
    if (result.length && tooClose(result[result.length - 1], hex)) continue;
    result.push(hex);
    if (result.length >= maxColors) break;
  }

  // Si todo el logo era neutro (logo blanco/negro), devuelve el negro y/o blanco que haya.
  if (result.length === 0) {
    const fallbackBuckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${quant(r)}_${quant(g)}_${quant(b)}`;
      const prev = fallbackBuckets.get(key);
      if (prev) prev.count++;
      else fallbackBuckets.set(key, { count: 1, r, g, b });
    }
    const top = [...fallbackBuckets.values()].sort((a, b) => b.count - a.count)[0];
    if (top) result.push(toHex(top.r, top.g, top.b));
  }

  return result;
}

function quant(v) {
  // 16 niveles por canal -> 4096 buckets posibles.
  return Math.round(v / 16) * 16;
}

function isNeutral(r, g, b) {
  // Descarta colores muy claros (casi blanco) y muy oscuros (casi negro).
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 235 && min > 235) return true;
  if (max < 25) return true;
  // Descarta grises muy desaturados (saturacion < 8%)
  if (max - min < 20) return true;
  return false;
}

function tooClose(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const d = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  return d < 30;
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function toHex(r, g, b) {
  const c = (n) => n.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
