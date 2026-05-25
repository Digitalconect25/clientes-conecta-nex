// Cada silueta define:
// - viewBox: caja de coordenadas del SVG
// - path: forma vectorial cerrada (rellena con fill)
// - qrBox: { x, y, size } donde se incrustara el QR cuadrado escaneable
//
// El QR siempre se renderiza dentro del qrBox con un cuadrado blanco
// detras como "zona segura" para garantizar escaneo.

// Cada silueta es una pieza solida (path). El composer le recorta un
// agujero rectangular del tamano exacto del qrBox para incrustar el QR
// sin marcos blancos visibles ni espacios duplicados.
export const SILHOUETTES = [
  {
    id: 'triangle',
    label: 'Triangulo (Dorito)',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 580 540 L 20 540 Z',
    qrBox: { x: 170, y: 270, size: 260 },
    defaultFill: '#e85d2f',
  },
  {
    id: 'circle',
    label: 'Circulo / Disco',
    viewBox: '0 0 600 600',
    path: 'M 300 30 a 270 270 0 1 0 0 540 a 270 270 0 1 0 0 -540 Z',
    qrBox: { x: 110, y: 110, size: 380 },
    defaultFill: '#1f4e8a',
  },
  {
    id: 'hexagon',
    label: 'Hexagono',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 540 165 L 540 435 L 300 570 L 60 435 L 60 165 Z',
    qrBox: { x: 100, y: 100, size: 400 },
    defaultFill: '#6b46c1',
  },
  {
    id: 'star',
    label: 'Estrella',
    viewBox: '0 0 600 600',
    path: starPath(300, 320, 280, 130, 5),
    qrBox: { x: 175, y: 200, size: 250 },
    defaultFill: '#f59e0b',
  },
  {
    id: 'heart',
    label: 'Corazon',
    viewBox: '0 0 600 600',
    path: 'M 300 555 C 60 405, 30 195, 165 105 C 240 60, 300 105, 300 195 C 300 105, 360 60, 435 105 C 570 195, 540 405, 300 555 Z',
    qrBox: { x: 140, y: 175, size: 320 },
    defaultFill: '#dc2626',
  },
  {
    id: 'house',
    label: 'Casa (inmobiliaria)',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 570 270 L 510 270 L 510 555 L 90 555 L 90 270 L 30 270 Z',
    qrBox: { x: 130, y: 270, size: 290 },
    defaultFill: '#0d9488',
  },
  {
    id: 'shield',
    label: 'Escudo',
    viewBox: '0 0 600 600',
    path: 'M 300 30 L 90 105 L 90 330 C 90 450, 180 540, 300 570 C 420 540, 510 450, 510 330 L 510 105 Z',
    qrBox: { x: 130, y: 150, size: 340 },
    defaultFill: '#0f766e',
  },
  {
    id: 'tag',
    label: 'Etiqueta',
    viewBox: '0 0 600 600',
    path: 'M 90 90 L 420 90 L 570 300 L 420 510 L 90 510 Z M 180 270 a 30 30 0 1 0 0 60 a 30 30 0 1 0 0 -60 Z',
    qrBox: { x: 210, y: 150, size: 300 },
    defaultFill: '#7c3aed',
  },
  {
    id: 'cloud',
    label: 'Nube',
    viewBox: '0 0 600 600',
    path: 'M 165 195 C 90 195, 60 270, 90 330 C 30 360, 30 450, 105 480 L 495 480 C 570 450, 570 360, 510 330 C 540 270, 510 195, 435 195 C 420 120, 330 90, 270 135 C 225 105, 180 135, 165 195 Z',
    qrBox: { x: 140, y: 200, size: 320 },
    defaultFill: '#3b82f6',
  },
  {
    id: 'drop',
    label: 'Gota',
    viewBox: '0 0 600 600',
    path: 'M 300 30 C 480 270, 540 390, 480 480 C 420 570, 180 570, 120 480 C 60 390, 120 270, 300 30 Z',
    qrBox: { x: 140, y: 240, size: 320 },
    defaultFill: '#0ea5e9',
  },
  {
    id: 'leaf',
    label: 'Hoja',
    viewBox: '0 0 600 600',
    path: 'M 90 510 C 90 270, 240 90, 510 90 C 510 360, 360 510, 90 510 Z',
    qrBox: { x: 155, y: 155, size: 290 },
    defaultFill: '#16a34a',
  },
  {
    id: 'rounded',
    label: 'Cuadrado redondeado',
    viewBox: '0 0 600 600',
    path: 'M 90 30 L 510 30 a 60 60 0 0 1 60 60 L 570 510 a 60 60 0 0 1 -60 60 L 90 570 a 60 60 0 0 1 -60 -60 L 30 90 a 60 60 0 0 1 60 -60 Z',
    qrBox: { x: 70, y: 70, size: 460 },
    defaultFill: '#1f2937',
  },
  {
    id: 'bone',
    label: 'Hueso (veterinaria)',
    viewBox: '0 0 600 600',
    path: 'M 90 200 a 75 75 0 1 1 60 90 L 150 310 a 75 75 0 1 1 -60 90 L 450 400 a 75 75 0 1 1 60 -90 L 450 290 a 75 75 0 1 1 -60 -90 Z',
    qrBox: { x: 165, y: 230, size: 270 },
    defaultFill: '#a16207',
  },
  {
    id: 'wineglass',
    label: 'Copa de vino (bar)',
    viewBox: '0 0 600 600',
    path: 'M 180 60 L 420 60 C 460 240, 380 360, 320 380 L 320 510 L 420 510 L 420 555 L 180 555 L 180 510 L 280 510 L 280 380 C 220 360, 140 240, 180 60 Z',
    qrBox: { x: 215, y: 130, size: 170 },
    defaultFill: '#7f1d1d',
  },
  {
    id: 'apple',
    label: 'Manzana (fruteria)',
    viewBox: '0 0 600 600',
    path: 'M 320 90 C 340 60, 380 50, 410 70 C 405 110, 380 130, 350 130 C 360 140, 380 150, 410 160 C 510 200, 555 320, 510 440 C 470 540, 380 580, 300 530 C 220 580, 130 540, 90 440 C 45 320, 90 200, 190 160 C 230 145, 270 145, 300 165 C 300 140, 310 115, 320 90 Z',
    qrBox: { x: 165, y: 245, size: 270 },
    defaultFill: '#dc2626',
  },
  {
    id: 'coffee',
    label: 'Taza de cafe',
    viewBox: '0 0 600 600',
    path: 'M 90 150 L 420 150 L 420 320 C 510 320, 540 360, 540 410 C 540 460, 510 500, 420 500 L 420 510 C 420 540, 390 555, 360 555 L 150 555 C 120 555, 90 540, 90 510 Z M 420 360 L 420 460 C 470 460, 490 440, 490 410 C 490 380, 470 360, 420 360 Z',
    qrBox: { x: 130, y: 200, size: 250 },
    defaultFill: '#78350f',
  },
  {
    id: 'horseshoe',
    label: 'Herradura (equestre)',
    viewBox: '0 0 600 600',
    path: 'M 120 80 L 220 80 L 220 240 C 220 320, 280 380, 300 380 C 320 380, 380 320, 380 240 L 380 80 L 480 80 L 480 340 C 480 460, 400 540, 300 540 C 200 540, 120 460, 120 340 Z M 150 110 L 190 110 L 190 240 C 190 340, 240 410, 300 410 C 360 410, 410 340, 410 240 L 410 110 L 450 110 L 450 340 C 450 440, 380 510, 300 510 C 220 510, 150 440, 150 340 Z',
    qrBox: { x: 215, y: 130, size: 170 },
    defaultFill: '#1f2937',
  },
  {
    id: 'mic',
    label: 'Microfono (eventos)',
    viewBox: '0 0 600 600',
    path: 'M 300 60 C 230 60, 200 110, 200 180 L 200 280 C 200 350, 230 400, 300 400 C 370 400, 400 350, 400 280 L 400 180 C 400 110, 370 60, 300 60 Z M 140 280 L 165 280 C 165 360, 220 420, 290 425 L 290 495 L 210 495 L 210 535 L 390 535 L 390 495 L 310 495 L 310 425 C 380 420, 435 360, 435 280 L 460 280 C 460 380, 380 460, 300 460 C 220 460, 140 380, 140 280 Z',
    qrBox: { x: 215, y: 130, size: 170 },
    defaultFill: '#4c1d95',
  },
];

// Genera una silueta dinamica con una letra grande. La letra se renderiza
// MAS GRANDE que el viewBox (font-size 130%) para que sus trazos asomen
// claramente por todos los lados alrededor del QR (que ocupa el 60% del
// centro). Si el QR fuera demasiado grande, la letra entera quedaria
// dentro del agujero y desapareceria.
export function letterSilhouette(letter, font) {
  const safeLetter = (letter || 'A').slice(0, 2);
  return {
    id: 'letter',
    label: 'Letra',
    viewBox: '0 0 600 600',
    isText: true,
    text: safeLetter,
    font: font || 'Arial Black, sans-serif',
    qrBox: { x: 120, y: 120, size: 360 },
    fontScale: 1.3,
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
