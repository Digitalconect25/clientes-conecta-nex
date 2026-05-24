// Cada silueta define:
// - viewBox: caja de coordenadas del SVG
// - path: forma vectorial cerrada (rellena con fill)
// - qrBox: { x, y, size } donde se incrustara el QR cuadrado escaneable
//
// El QR siempre se renderiza dentro del qrBox con un cuadrado blanco
// detras como "zona segura" para garantizar escaneo.

export const SILHOUETTES = [
  {
    id: 'triangle',
    label: 'Triangulo (Dorito)',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 580 540 L 20 540 Z',
    qrBox: { x: 175, y: 280, size: 250 },
    defaultFill: '#e85d2f',
  },
  {
    id: 'circle',
    label: 'Circulo / Disco',
    viewBox: '0 0 600 600',
    path: 'M 300 30 a 270 270 0 1 0 0 540 a 270 270 0 1 0 0 -540 Z',
    qrBox: { x: 150, y: 150, size: 300 },
    defaultFill: '#1f4e8a',
  },
  {
    id: 'hexagon',
    label: 'Hexagono',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 540 165 L 540 435 L 300 570 L 60 435 L 60 165 Z',
    qrBox: { x: 150, y: 150, size: 300 },
    defaultFill: '#6b46c1',
  },
  {
    id: 'star',
    label: 'Estrella',
    viewBox: '0 0 600 600',
    path: starPath(300, 320, 280, 130, 5),
    qrBox: { x: 195, y: 245, size: 210 },
    defaultFill: '#f59e0b',
  },
  {
    id: 'heart',
    label: 'Corazon',
    viewBox: '0 0 600 600',
    path: 'M 300 555 C 60 405, 30 195, 165 105 C 240 60, 300 105, 300 195 C 300 105, 360 60, 435 105 C 570 195, 540 405, 300 555 Z',
    qrBox: { x: 165, y: 195, size: 270 },
    defaultFill: '#dc2626',
  },
  {
    id: 'house',
    label: 'Casa (inmobiliaria)',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 570 270 L 510 270 L 510 555 L 90 555 L 90 270 L 30 270 Z',
    qrBox: { x: 165, y: 285, size: 270 },
    defaultFill: '#0d9488',
  },
  {
    id: 'shield',
    label: 'Escudo',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 90 105 L 90 330 C 90 450, 180 540, 300 570 C 420 540, 510 450, 510 330 L 510 105 Z',
    qrBox: { x: 165, y: 150, size: 270 },
    defaultFill: '#0f766e',
  },
  {
    id: 'tag',
    label: 'Etiqueta',
    viewBox: '0 0 600 600',
    path: 'M 90 90 L 420 90 L 570 300 L 420 510 L 90 510 Z M 180 270 a 30 30 0 1 0 0 60 a 30 30 0 1 0 0 -60 Z',
    qrBox: { x: 225, y: 195, size: 240 },
    defaultFill: '#7c3aed',
  },
  {
    id: 'cloud',
    label: 'Nube',
    viewBox: '0 0 600 600',
    path: 'M 165 195 C 90 195, 60 270, 90 330 C 30 360, 30 450, 105 480 L 495 480 C 570 450, 570 360, 510 330 C 540 270, 510 195, 435 195 C 420 120, 330 90, 270 135 C 225 105, 180 135, 165 195 Z',
    qrBox: { x: 165, y: 240, size: 270 },
    defaultFill: '#3b82f6',
  },
  {
    id: 'drop',
    label: 'Gota',
    viewBox: '0 0 600 600',
    path: 'M 300 30 C 480 270, 540 390, 480 480 C 420 570, 180 570, 120 480 C 60 390, 120 270, 300 30 Z',
    qrBox: { x: 165, y: 270, size: 270 },
    defaultFill: '#0ea5e9',
  },
  {
    id: 'leaf',
    label: 'Hoja',
    viewBox: '0 0 600 600',
    path: 'M 90 510 C 90 270, 240 90, 510 90 C 510 360, 360 510, 90 510 Z',
    qrBox: { x: 180, y: 195, size: 240 },
    defaultFill: '#16a34a',
  },
  {
    id: 'rounded',
    label: 'Cuadrado redondeado',
    viewBox: '0 0 600 600',
    path: 'M 90 30 L 510 30 a 60 60 0 0 1 60 60 L 570 510 a 60 60 0 0 1 -60 60 L 90 570 a 60 60 0 0 1 -60 -60 L 30 90 a 60 60 0 0 1 60 -60 Z',
    qrBox: { x: 120, y: 120, size: 360 },
    defaultFill: '#1f2937',
  },
];

// Genera una silueta dinamica con una letra grande. Se usa una bounding
// box conservadora para el qrBox (el usuario puede ajustarla con sliders).
export function letterSilhouette(letter, font) {
  const safeLetter = (letter || 'A').slice(0, 2);
  return {
    id: 'letter',
    label: 'Letra',
    viewBox: '0 0 600 600',
    isText: true,
    text: safeLetter,
    font: font || 'Arial Black, sans-serif',
    qrBox: { x: 195, y: 225, size: 210 },
    defaultFill: '#1f2937',
  };
}

function starPath(cx, cy, outerR, innerR, points) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = step * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d + 'Z';
}
