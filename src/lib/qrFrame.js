// Compone un SVG final: silueta solida (rellena al 100%, sin recortes)
// con el QR superpuesto encima. El QR puede ir CON o SIN su zona blanca
// de seguridad - por defecto sin ella para que se vea como UNA SOLA
// figura integrada (modulos del QR directamente sobre el color de la
// silueta). Si el usuario activa 'safeZone', se anade un rectangulo
// blanco detras del QR para maxima legibilidad sobre fondos oscuros.

export function composeQrInSilhouette({
  qrSvgText,
  silhouette,
  silhouetteFill,
  customSvgText,
  customQrBox,
  bgColor,
  outputSize = 1200,
  safeZone = false,
}) {
  const fill = silhouetteFill || silhouette.defaultFill || '#000';

  const qrInner = extractInnerSvg(qrSvgText);
  if (!qrInner) throw new Error('QR SVG vacio o invalido');

  let viewBox;
  let backgroundShape;
  let qrBox;

  if (customSvgText) {
    const parsed = parseCustomSvg(customSvgText);
    viewBox = parsed.viewBox;
    qrBox = customQrBox || defaultQrBoxForViewBox(parsed.viewBox);
    backgroundShape = parsed.body;
  } else if (silhouette.isText) {
    viewBox = silhouette.viewBox;
    qrBox = silhouette.qrBox;
    const [, , vbW, vbH] = parseViewBox(viewBox);
    const fontScale = silhouette.fontScale || 1.0;
    const fontSize = vbH * fontScale;
    backgroundShape = `<text x="${vbW / 2}" y="${vbH / 2}" font-family="${silhouette.font}" font-weight="900" font-size="${fontSize}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${escapeXml(silhouette.text)}</text>`;
  } else {
    viewBox = silhouette.viewBox;
    qrBox = silhouette.qrBox;
    backgroundShape = `<path d="${silhouette.path}" fill="${fill}" fill-rule="evenodd"/>`;
  }

  const [vbX, vbY, vbW, vbH] = parseViewBox(viewBox);

  const safetyRect = safeZone
    ? `<rect x="${qrBox.x}" y="${qrBox.y}" width="${qrBox.size}" height="${qrBox.size}" fill="#ffffff"/>`
    : '';

  const qrPlacement = `
    ${safetyRect}
    <g transform="translate(${qrBox.x}, ${qrBox.y}) scale(${qrBox.size / qrInner.size})">
      ${qrInner.body}
    </g>`;

  const bgRect = bgColor && bgColor !== 'transparent'
    ? `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="${viewBox}">
  ${bgRect}
  ${backgroundShape}
  ${qrPlacement}
</svg>`;
}

// Devuelve { body, size } a partir de un SVG cuadrado del QR.
// size es el lado del viewBox (asumimos cuadrado).
function extractInnerSvg(svgText) {
  const cleaned = svgText.replace(/<\?xml[^?]*\?>/g, '').trim();
  const openMatch = cleaned.match(/<svg\b([^>]*)>/i);
  if (!openMatch) return null;
  const attrs = openMatch[1];

  const viewBoxMatch = attrs.match(/viewBox\s*=\s*"([^"]+)"/i);
  let size = null;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) size = parts[2];
  }
  if (!size) {
    const wMatch = attrs.match(/width\s*=\s*"([\d.]+)/i);
    if (wMatch) size = parseFloat(wMatch[1]);
  }
  if (!size) size = 300;

  const body = cleaned
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();

  return { body, size };
}

function parseCustomSvg(svgText) {
  const cleaned = svgText.replace(/<\?xml[^?]*\?>/g, '').trim();
  const openMatch = cleaned.match(/<svg\b([^>]*)>/i);
  if (!openMatch) throw new Error('SVG personalizado invalido');
  const attrs = openMatch[1];

  let viewBox;
  const vbMatch = attrs.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (vbMatch) {
    viewBox = vbMatch[1];
  } else {
    const wMatch = attrs.match(/width\s*=\s*"([\d.]+)/i);
    const hMatch = attrs.match(/height\s*=\s*"([\d.]+)/i);
    const w = wMatch ? parseFloat(wMatch[1]) : 600;
    const h = hMatch ? parseFloat(hMatch[1]) : 600;
    viewBox = `0 0 ${w} ${h}`;
  }

  const body = cleaned
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();

  return { viewBox, body };
}

function parseViewBox(vb) {
  return vb.trim().split(/\s+/).map(Number);
}

function defaultQrBoxForViewBox(vb) {
  const [, , w, h] = parseViewBox(vb);
  const side = Math.min(w, h) * 0.45;
  return { x: (w - side) / 2, y: (h - side) / 2, size: side };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
