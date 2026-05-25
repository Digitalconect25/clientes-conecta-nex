import QRCode from 'qrcode';

export const CREATIVE_SHAPES = [
  { value: 'triangle-up', label: 'Triangulo (arriba)' },
  { value: 'triangle-down', label: 'Triangulo (abajo)' },
  { value: 'diamond', label: 'Diamante' },
  { value: 'star', label: 'Estrella' },
  { value: 'heart', label: 'Corazon' },
  { value: 'hexagon', label: 'Hexagono' },
  { value: 'cross', label: 'Cruz' },
  { value: 'drop', label: 'Gota' },
  { value: 'leaf', label: 'Hoja' },
  { value: 'flower', label: 'Flor' },
  { value: 'letter', label: 'Letra / simbolo' },
];

const CREATIVE_VALUES = new Set(CREATIVE_SHAPES.map((s) => s.value));

export function isCreativeShape(v) {
  return CREATIVE_VALUES.has(v);
}

function shapePath(shape, x, y, c) {
  const r = c / 2;
  const cx = x + r;
  const cy = y + r;
  switch (shape) {
    case 'triangle-up':
      return `M ${cx} ${y} L ${x + c} ${y + c} L ${x} ${y + c} Z`;
    case 'triangle-down':
      return `M ${x} ${y} L ${x + c} ${y} L ${cx} ${y + c} Z`;
    case 'diamond':
      return `M ${cx} ${y} L ${x + c} ${cy} L ${cx} ${y + c} L ${x} ${cy} Z`;
    case 'hexagon': {
      const q = c * 0.25;
      return `M ${x + q} ${y} L ${x + c - q} ${y} L ${x + c} ${cy} L ${x + c - q} ${y + c} L ${x + q} ${y + c} L ${x} ${cy} Z`;
    }
    case 'cross': {
      const t = c * 0.32;
      const ox = x + (c - t) / 2;
      const oy = y + (c - t) / 2;
      return `M ${ox} ${y} h ${t} v ${(c - t) / 2} h ${(c - t) / 2} v ${t} h ${-(c - t) / 2} v ${(c - t) / 2} h ${-t} v ${-(c - t) / 2} h ${-(c - t) / 2} v ${-t} h ${(c - t) / 2} Z`;
    }
    case 'star': {
      const outer = r;
      const inner = r * 0.45;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
      }
      return `M ${pts.join(' L ')} Z`;
    }
    case 'heart': {
      const t = c;
      return `M ${cx} ${y + t * 0.95}
              C ${x - t * 0.05} ${y + t * 0.55}, ${x + t * 0.15} ${y + t * 0.05}, ${cx} ${y + t * 0.35}
              C ${x + t * 0.85} ${y + t * 0.05}, ${x + t * 1.05} ${y + t * 0.55}, ${cx} ${y + t * 0.95} Z`;
    }
    case 'drop':
      return `M ${cx} ${y}
              C ${x + c} ${y + c * 0.45}, ${x + c} ${y + c * 0.95}, ${cx} ${y + c}
              C ${x} ${y + c * 0.95}, ${x} ${y + c * 0.45}, ${cx} ${y} Z`;
    case 'leaf':
      return `M ${x} ${y + c}
              C ${x} ${y + c * 0.3}, ${x + c * 0.3} ${y}, ${x + c} ${y}
              C ${x + c} ${y + c * 0.7}, ${x + c * 0.7} ${y + c}, ${x} ${y + c} Z`;
    case 'flower': {
      const pr = r * 0.55;
      return `M ${cx - pr} ${cy} a ${pr} ${pr} 0 1 0 ${pr * 2} 0 a ${pr} ${pr} 0 1 0 ${-pr * 2} 0
              M ${cx} ${cy - pr} a ${pr} ${pr} 0 1 0 0 ${pr * 2} a ${pr} ${pr} 0 1 0 0 ${-pr * 2}`;
    }
    default:
      return `M ${x} ${y} h ${c} v ${c} h ${-c} Z`;
  }
}

function isInFinder(row, col, size) {
  const inTL = row < 7 && col < 7;
  const inTR = row < 7 && col >= size - 7;
  const inBL = row >= size - 7 && col < 7;
  return inTL || inTR || inBL;
}

export const FRAME_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'extra-rounded', label: 'Extra redondeado' },
  { value: 'circle', label: 'Circulo' },
  { value: 'leaf-tl', label: 'Hoja (esq superior-izq)' },
  { value: 'leaf-br', label: 'Hoja (esq inferior-der)' },
];

export const PUPIL_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'dot', label: 'Punto / Circulo' },
  { value: 'diamond', label: 'Diamante' },
  { value: 'star', label: 'Estrella' },
  { value: 'heart', label: 'Corazon' },
  { value: 'plus', label: 'Cruz' },
];

function frameBody(style, x, y, w, color) {
  switch (style) {
    case 'square':
      return `<path d="M ${x} ${y} h ${w} v ${w} h ${-w} Z M ${x + w / 7} ${y + w / 7} h ${5 * w / 7} v ${5 * w / 7} h ${-5 * w / 7} Z" fill="${color}" fill-rule="evenodd"/>`;
    case 'rounded': {
      const r = w * 0.18;
      const iw = 5 * w / 7;
      const ir = iw * 0.18;
      const ix = x + w / 7;
      const iy = y + w / 7;
      return `<path d="
        M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${w - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${w - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z
        M ${ix + ir} ${iy} h ${iw - 2 * ir} a ${ir} ${ir} 0 0 1 ${ir} ${ir} v ${iw - 2 * ir} a ${ir} ${ir} 0 0 1 -${ir} ${ir} h -${iw - 2 * ir} a ${ir} ${ir} 0 0 1 -${ir} -${ir} v -${iw - 2 * ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} Z
      " fill="${color}" fill-rule="evenodd"/>`;
    }
    case 'extra-rounded': {
      const r = w * 0.32;
      const iw = 5 * w / 7;
      const ir = iw * 0.32;
      const ix = x + w / 7;
      const iy = y + w / 7;
      return `<path d="
        M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${w - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${w - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z
        M ${ix + ir} ${iy} h ${iw - 2 * ir} a ${ir} ${ir} 0 0 1 ${ir} ${ir} v ${iw - 2 * ir} a ${ir} ${ir} 0 0 1 -${ir} ${ir} h -${iw - 2 * ir} a ${ir} ${ir} 0 0 1 -${ir} -${ir} v -${iw - 2 * ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} Z
      " fill="${color}" fill-rule="evenodd"/>`;
    }
    case 'circle': {
      const cx = x + w / 2;
      const cy = y + w / 2;
      const ro = w / 2;
      const ri = ro * 5 / 7;
      return `<path d="
        M ${cx - ro} ${cy} a ${ro} ${ro} 0 1 0 ${ro * 2} 0 a ${ro} ${ro} 0 1 0 -${ro * 2} 0
        M ${cx - ri} ${cy} a ${ri} ${ri} 0 1 1 ${ri * 2} 0 a ${ri} ${ri} 0 1 1 -${ri * 2} 0
      " fill="${color}" fill-rule="evenodd"/>`;
    }
    case 'leaf-tl': {
      const r = w * 0.45;
      const iw = 5 * w / 7;
      const ir = iw * 0.45;
      const ix = x + w / 7;
      const iy = y + w / 7;
      return `<path d="
        M ${x + r} ${y} h ${w - r} v ${w - r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - r} v -${w - r} a ${r} ${r} 0 0 1 ${r} -${r} Z
        M ${ix + ir} ${iy} h ${iw - ir} v ${iw - ir} a ${ir} ${ir} 0 0 1 -${ir} ${ir} h -${iw - ir} v -${iw - ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} Z
      " fill="${color}" fill-rule="evenodd"/>`;
    }
    case 'leaf-br': {
      const r = w * 0.45;
      const iw = 5 * w / 7;
      const ir = iw * 0.45;
      const ix = x + w / 7;
      const iy = y + w / 7;
      return `<path d="
        M ${x} ${y + r} a ${r} ${r} 0 0 1 ${r} -${r} h ${w - r} v ${w - r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - r} Z
        M ${ix} ${iy + ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} h ${iw - ir} v ${iw - ir} a ${ir} ${ir} 0 0 1 -${ir} ${ir} h -${iw - ir} Z
      " fill="${color}" fill-rule="evenodd"/>`;
    }
    default:
      return frameBody('square', x, y, w, color);
  }
}

function pupilBody(style, x, y, w, color) {
  const cx = x + w / 2;
  const cy = y + w / 2;
  const r = w / 2;
  switch (style) {
    case 'square':
      return `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${color}"/>`;
    case 'rounded': {
      const rr = w * 0.25;
      return `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${rr}" fill="${color}"/>`;
    }
    case 'dot':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
    case 'diamond':
      return `<path d="M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + w} L ${x} ${cy} Z" fill="${color}"/>`;
    case 'star': {
      const inner = r * 0.45;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
      }
      return `<path d="M ${pts.join(' L ')} Z" fill="${color}"/>`;
    }
    case 'heart':
      return `<path d="M ${cx} ${y + w * 0.95}
        C ${x - w * 0.05} ${y + w * 0.55}, ${x + w * 0.15} ${y + w * 0.05}, ${cx} ${y + w * 0.35}
        C ${x + w * 0.85} ${y + w * 0.05}, ${x + w * 1.05} ${y + w * 0.55}, ${cx} ${y + w * 0.95} Z" fill="${color}"/>`;
    case 'plus': {
      const t = w * 0.32;
      const ox = x + (w - t) / 2;
      const oy = y + (w - t) / 2;
      return `<path d="M ${ox} ${y} h ${t} v ${(w - t) / 2} h ${(w - t) / 2} v ${t} h ${-(w - t) / 2} v ${(w - t) / 2} h ${-t} v ${-(w - t) / 2} h ${-(w - t) / 2} v ${-t} h ${(w - t) / 2} Z" fill="${color}"/>`;
    }
    default:
      return pupilBody('square', x, y, w, color);
  }
}

function finderPaths(size, cell, frameColor, pupilColor, frameStyle, pupilStyle) {
  const positions = [
    [0, 0, frameStyle],
    [0, size - 7, mirrorFrame(frameStyle, 'tr')],
    [size - 7, 0, mirrorFrame(frameStyle, 'bl')],
  ];
  let out = '';
  for (const [r, c, fStyle] of positions) {
    const x = c * cell;
    const y = r * cell;
    const w = 7 * cell;
    const innerOff = 2 * cell;
    const innerSize = 3 * cell;
    out += frameBodyAny(fStyle, x, y, w, frameColor);
    out += pupilBody(pupilStyle, x + innerOff, y + innerOff, innerSize, pupilColor);
  }
  return out;
}

function mirrorFrame(style, position) {
  if (style === 'leaf-tl') {
    if (position === 'tr') return 'leaf-tr';
    if (position === 'bl') return 'leaf-bl';
  }
  if (style === 'leaf-br') {
    if (position === 'tr') return 'leaf-bl';
    if (position === 'bl') return 'leaf-tr';
  }
  return style;
}

function frameBodyAny(style, x, y, w, color) {
  if (style === 'leaf-tr') {
    const r = w * 0.45;
    const iw = 5 * w / 7;
    const ir = iw * 0.45;
    const ix = x + w / 7;
    const iy = y + w / 7;
    return `<path d="
      M ${x} ${y} h ${w - r} a ${r} ${r} 0 0 1 ${r} ${r} v ${w - r} h -${w} v -${w - r} a ${r} ${r} 0 0 1 ${r} -${r} Z
      M ${ix} ${iy} h ${iw - ir} a ${ir} ${ir} 0 0 1 ${ir} ${ir} v ${iw - ir} h -${iw} v -${iw - ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} Z
    " fill="${color}" fill-rule="evenodd"/>`;
  }
  if (style === 'leaf-bl') {
    const r = w * 0.45;
    const iw = 5 * w / 7;
    const ir = iw * 0.45;
    const ix = x + w / 7;
    const iy = y + w / 7;
    return `<path d="
      M ${x + r} ${y} h ${w - r} v ${w} h -${w - r} a ${r} ${r} 0 0 1 -${r} -${r} v -${w - r} a ${r} ${r} 0 0 1 ${r} -${r} Z
      M ${ix + ir} ${iy} h ${iw - ir} v ${iw} h -${iw - ir} a ${ir} ${ir} 0 0 1 -${ir} -${ir} v -${iw - ir} a ${ir} ${ir} 0 0 1 ${ir} -${ir} Z
    " fill="${color}" fill-rule="evenodd"/>`;
  }
  return frameBody(style, x, y, w, color);
}

export async function renderCustomQR({
  data,
  shape,
  letter,
  letterFont,
  fillColor,
  bgColor,
  useGradient,
  fillColor2,
  errorLevel,
  cellSize = 16,
  margin = 4,
  logoDataUrl,
  logoSize = 0.35,
  hideBgDots = true,
  frameStyle = 'extra-rounded',
  pupilStyle = 'dot',
  frameColor,
  pupilColor,
  transparentBg = false,
}) {
  const qr = QRCode.create(data || ' ', { errorCorrectionLevel: errorLevel || 'H' });
  const size = qr.modules.size;
  const matrix = qr.modules.data;
  const totalCells = size + margin * 2;
  const px = totalCells * cellSize;

  const fillRef = useGradient ? 'url(#qrGrad)' : fillColor;

  let paths = '';
  let logoArea = null;
  if (logoDataUrl && hideBgDots) {
    const lw = Math.round(size * logoSize);
    const lr = Math.floor((size - lw) / 2);
    logoArea = { r0: lr, c0: lr, r1: lr + lw, c1: lr + lw };
  }

  let modulePaths = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dark = matrix[r * size + c] === 1;
      if (!dark) continue;
      if (isInFinder(r, c, size)) continue;
      if (logoArea && r >= logoArea.r0 && r < logoArea.r1 && c >= logoArea.c0 && c < logoArea.c1) continue;

      const x = (c + margin) * cellSize;
      const y = (r + margin) * cellSize;

      if (shape === 'letter') {
        const letterToUse = (letter && letter[0]) || 'A';
        modulePaths += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2}" font-size="${cellSize * 1.1}" font-family="${letterFont || 'Arial Black, sans-serif'}" font-weight="900" fill="${fillRef}" text-anchor="middle" dominant-baseline="central">${escapeXml(letterToUse)}</text>`;
      } else {
        modulePaths += `<path d="${shapePath(shape, x, y, cellSize)}" fill="${fillRef}"/>`;
      }
    }
  }

  const finderOffsetX = margin * cellSize;
  const finalFrameColor = frameColor || fillColor;
  const finalPupilColor = pupilColor || frameColor || fillColor;
  const finderG = `<g transform="translate(${finderOffsetX}, ${finderOffsetX})">${finderPaths(size, cellSize, finalFrameColor, finalPupilColor, frameStyle, pupilStyle)}</g>`;

  const gradientDef = useGradient
    ? `<defs><linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${fillColor}"/>
          <stop offset="100%" stop-color="${fillColor2}"/>
        </linearGradient></defs>`
    : '';

  let logoTag = '';
  if (logoDataUrl) {
    const lw = size * logoSize * cellSize;
    const lx = (px - lw) / 2;
    if (hideBgDots) {
      const pad = cellSize * 0.5;
      logoTag += `<rect x="${lx - pad}" y="${lx - pad}" width="${lw + pad * 2}" height="${lw + pad * 2}" fill="${bgColor}" rx="${cellSize * 0.4}"/>`;
    }
    logoTag += `<image href="${logoDataUrl}" x="${lx}" y="${lx}" width="${lw}" height="${lw}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  paths = gradientDef + finderG + modulePaths + logoTag;

  const bgRect = transparentBg ? '' : `<rect width="100%" height="100%" fill="${bgColor}"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  ${bgRect}
  ${paths}
</svg>`;

  return { svg, size: px };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export async function svgToPngBlob(svg, sizePx) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sizePx;
      canvas.height = sizePx;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sizePx, sizePx);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png');
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
