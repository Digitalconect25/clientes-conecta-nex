import { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import html2pdf from 'html2pdf.js';
import { CREATIVE_SHAPES, FRAME_STYLES as CORNER_FRAME_STYLES, PUPIL_STYLES, isCreativeShape, renderCustomQR, svgToPngBlob } from '../lib/customQR.js';
import { ICONS, ICON_BY_ID } from '../lib/qrIcons.js';
import { extractPalette } from '../lib/colorExtractor.js';

const STANDARD_DOT_STYLES = [
  { value: 'square', label: 'Cuadrado clasico' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'dots', label: 'Puntos' },
  { value: 'classy', label: 'Elegante' },
  { value: 'classy-rounded', label: 'Elegante redondeado' },
  { value: 'extra-rounded', label: 'Extra redondeado' },
];

const LETTER_FONTS = [
  { value: 'Arial Black, sans-serif', label: 'Arial Black (gruesa)' },
  { value: 'Impact, sans-serif', label: 'Impact (condensada)' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: '"Courier New", monospace', label: 'Courier (monoespaciada)' },
  { value: '-apple-system, BlinkMacSystemFont, sans-serif', label: 'Sistema' },
  { value: '"Bebas Neue", sans-serif', label: 'Bebas Neue (display alta)' },
  { value: 'Anton, sans-serif', label: 'Anton (deportiva)' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat Black (moderna)' },
  { value: '"Playfair Display", serif', label: 'Playfair (elegante)' },
  { value: 'Pacifico, cursive', label: 'Pacifico (manuscrita)' },
];

const CORNER_SQUARE_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'dot', label: 'Punto / Circulo' },
  { value: 'extra-rounded', label: 'Extra redondeado' },
];

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'dot', label: 'Punto / Circulo' },
];

// Para auto-sincronizar las esquinas cuando se cambia la forma de los puntos.
// (Estilos qr-code-styling)
const STD_AUTO_CORNERS = {
  square: { sq: 'square', dot: 'square' },
  rounded: { sq: 'extra-rounded', dot: 'square' },
  dots: { sq: 'dot', dot: 'dot' },
  classy: { sq: 'extra-rounded', dot: 'dot' },
  'classy-rounded': { sq: 'extra-rounded', dot: 'dot' },
  'extra-rounded': { sq: 'extra-rounded', dot: 'dot' },
};

// Para el modo creativo, default coherente al elegir formas.
const CREATIVE_DEFAULT_CORNERS = {
  'triangle-up': { frame: 'leaf-tl', pupil: 'diamond' },
  'triangle-down': { frame: 'leaf-br', pupil: 'diamond' },
  diamond: { frame: 'extra-rounded', pupil: 'diamond' },
  star: { frame: 'extra-rounded', pupil: 'star' },
  heart: { frame: 'extra-rounded', pupil: 'heart' },
  hexagon: { frame: 'rounded', pupil: 'rounded' },
  cross: { frame: 'rounded', pupil: 'plus' },
  drop: { frame: 'circle', pupil: 'dot' },
  leaf: { frame: 'leaf-tl', pupil: 'rounded' },
  flower: { frame: 'circle', pupil: 'dot' },
  letter: { frame: 'rounded', pupil: 'square' },
};

const ERROR_LEVELS = [
  { value: 'L', label: 'Baja (7%)' },
  { value: 'M', label: 'Media (15%)' },
  { value: 'Q', label: 'Alta (25%)' },
  { value: 'H', label: 'Muy alta (30%) - recomendada con logo' },
];

// Plantillas rapidas: aplican colores + forma + esquinas + marco/cartel.
// Mantenemos url, logo y texto del usuario.
const TEMPLATES = [
  {
    id: 'gastronomia',
    label: 'Gastronomia',
    config: { dotStyle: 'classy-rounded', dotColor: '#7f1d1d', bgColor: '#ffffff', cornerColor: '#7f1d1d', cornerPupilColor: '#b91c1c', useGradient: false, frameMode: 'rounded', frameColor: '#fef3c7', headlineText: 'MENU DIGITAL', headlineColor: '#7f1d1d', cornerIcon: 'wineglass', cornerIconColor: '#b91c1c' },
  },
  {
    id: 'belleza',
    label: 'Belleza & Estetica',
    config: { dotStyle: 'rounded', dotColor: '#831843', bgColor: '#ffffff', cornerColor: '#9d174d', cornerPupilColor: '#ec4899', useGradient: true, dotColor2: '#ec4899', frameMode: 'card', frameColor: '#fdf2f8', headlineText: 'RESERVA TU CITA', headlineColor: '#831843', cornerIcon: 'heart', cornerIconColor: '#ec4899' },
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    config: { dotStyle: 'square', dotColor: '#1e3a8a', bgColor: '#ffffff', cornerColor: '#1e3a8a', cornerPupilColor: '#fbbf24', useGradient: false, frameMode: 'rounded', frameColor: '#eff6ff', headlineText: 'VER PROPIEDAD', headlineColor: '#1e3a8a', cornerIcon: 'house', cornerIconColor: '#fbbf24' },
  },
  {
    id: 'fitness',
    label: 'Fitness & Deporte',
    config: { dotStyle: 'extra-rounded', dotColor: '#111827', bgColor: '#ffffff', cornerColor: '#111827', cornerPupilColor: '#dc2626', useGradient: false, frameMode: 'card', frameColor: '#0a0a0a', headlineText: 'ENTRENA YA', headlineColor: '#ffffff', cornerIcon: 'star', cornerIconColor: '#dc2626' },
  },
  {
    id: 'tech',
    label: 'Tech / Startup',
    config: { dotStyle: 'dots', dotColor: '#1e40af', bgColor: '#ffffff', cornerColor: '#1e40af', cornerPupilColor: '#06b6d4', useGradient: true, dotColor2: '#06b6d4', frameMode: 'rounded', frameColor: '#f0f9ff', headlineText: 'VISITA LA WEB', headlineColor: '#1e40af', cornerIcon: 'wifi', cornerIconColor: '#06b6d4' },
  },
  {
    id: 'boda',
    label: 'Boda elegante',
    config: { dotStyle: 'classy', dotColor: '#1f2937', bgColor: '#ffffff', cornerColor: '#1f2937', cornerPupilColor: '#b45309', useGradient: false, frameMode: 'card', frameColor: '#fffbeb', headlineText: 'NUESTRA BODA', headlineColor: '#b45309', cornerIcon: 'heart', cornerIconColor: '#b45309' },
  },
  {
    id: 'cafeteria',
    label: 'Cafeteria',
    config: { dotStyle: 'rounded', dotColor: '#78350f', bgColor: '#ffffff', cornerColor: '#78350f', cornerPupilColor: '#a16207', useGradient: false, frameMode: 'rounded', frameColor: '#fef3c7', headlineText: 'LA CARTA', headlineColor: '#78350f', cornerIcon: 'coffee', cornerIconColor: '#78350f' },
  },
  {
    id: 'veterinaria',
    label: 'Veterinaria',
    config: { dotStyle: 'extra-rounded', dotColor: '#0f766e', bgColor: '#ffffff', cornerColor: '#0f766e', cornerPupilColor: '#f59e0b', useGradient: false, frameMode: 'rounded', frameColor: '#f0fdfa', headlineText: 'PIDE CITA', headlineColor: '#0f766e', cornerIcon: 'bone', cornerIconColor: '#f59e0b' },
  },
  {
    id: 'salud',
    label: 'Salud / Clinica',
    config: { dotStyle: 'rounded', dotColor: '#0f766e', bgColor: '#ffffff', cornerColor: '#0f766e', cornerPupilColor: '#dc2626', useGradient: false, frameMode: 'card', frameColor: '#ffffff', headlineText: 'RESERVA CITA', headlineColor: '#0f766e', cornerIcon: 'shield', cornerIconColor: '#0f766e' },
  },
];

const FRAME_MODES = [
  { value: 'none', label: 'Sin marco (QR pelado)' },
  { value: 'rect', label: 'Marco rectangular' },
  { value: 'rounded', label: 'Marco redondeado' },
  { value: 'card', label: 'Tarjeta con sombra' },
];

const RANDOM_PALETTES = [
  ['#1f2937', '#06b6d4'], ['#7c3aed', '#ec4899'], ['#047857', '#fbbf24'],
  ['#1e40af', '#06b6d4'], ['#dc2626', '#f59e0b'], ['#0f766e', '#84cc16'],
  ['#9d174d', '#fbbf24'], ['#111827', '#dc2626'], ['#0c4a6e', '#ec4899'],
];

const DEFAULT_STATE = {
  url: 'https://conectanex.es',
  size: 600,
  dotStyle: 'extra-rounded',
  cornerSquareStyle: 'extra-rounded',
  cornerDotStyle: 'dot',
  frameStyle: 'extra-rounded',
  pupilStyle: 'dot',
  useGradient: false,
  dotColor: '#000000',
  dotColor2: '#047857',
  cornerColor: '#000000',
  cornerPupilColor: '',
  bgColor: '#ffffff',
  errorLevel: 'H',
  logoDataUrl: '',
  logoSize: 0.35,
  hideBgDots: true,
  texto: 'Escanea para ver el menu',
  textoTamano: 18,
  textoColor: '#1f2937',
  letra: 'A',
  letterFont: 'Arial Black, sans-serif',
  frameMode: 'none',
  frameColor: '#f3f4f6',
  framePadding: 60,
  headlineText: '',
  headlineSize: 32,
  headlineColor: '#1f2937',
  cornerIcon: 'none',
  cornerIconColor: '#1f2937',
  bgImageDataUrl: '',
  bgImageOpacity: 0.5,
  animateGradient: false,
  animationSpeed: 4,
};

export default function GeneradorQR() {
  const [s, setS] = useState(DEFAULT_STATE);
  const qrRef = useRef(null);
  const qrContainer = useRef(null);
  const exportableRef = useRef(null);
  const lastCreativeSvgRef = useRef('');
  const [logoPalette, setLogoPalette] = useState([]);

  const creative = isCreativeShape(s.dotStyle);
  const useFrame = s.frameMode !== 'none';

  function set(k, v) {
    setS((x) => {
      const next = { ...x, [k]: v };
      if (k === 'dotStyle') {
        if (isCreativeShape(v)) {
          const def = CREATIVE_DEFAULT_CORNERS[v];
          if (def) { next.frameStyle = def.frame; next.pupilStyle = def.pupil; }
        } else {
          const def = STD_AUTO_CORNERS[v];
          if (def) { next.cornerSquareStyle = def.sq; next.cornerDotStyle = def.dot; }
        }
      }
      return next;
    });
  }

  useEffect(() => {
    qrRef.current = new QRCodeStyling(buildOptions(s));
  }, []);

  useEffect(() => {
    if (!qrContainer.current) return;
    let cancelled = false;
    async function render() {
      const finalSvg = await getQrSvgText();
      if (!cancelled && qrContainer.current) {
        qrContainer.current.innerHTML = finalSvg;
      }
    }
    render().catch(console.error);
    return () => { cancelled = true; };
  }, [s, creative, useFrame]);

  function creativeOpts(state) {
    return {
      data: state.url || ' ',
      shape: state.dotStyle,
      letter: state.letra,
      letterFont: state.letterFont,
      fillColor: state.dotColor,
      bgColor: state.bgColor,
      useGradient: state.useGradient,
      fillColor2: state.dotColor2,
      errorLevel: state.errorLevel,
      cellSize: 16,
      margin: 4,
      logoDataUrl: state.logoDataUrl,
      logoSize: state.logoSize,
      hideBgDots: state.hideBgDots,
      frameStyle: state.frameStyle,
      pupilStyle: state.pupilStyle,
      frameColor: state.cornerColor,
      pupilColor: state.cornerPupilColor || state.cornerColor,
    };
  }

  function buildOptions(state) {
    const dotsOptions = state.useGradient
      ? {
          type: state.dotStyle,
          gradient: {
            type: 'linear',
            rotation: 0,
            colorStops: [
              { offset: 0, color: state.dotColor },
              { offset: 1, color: state.dotColor2 },
            ],
          },
        }
      : { type: state.dotStyle, color: state.dotColor };

    return {
      width: state.size,
      height: state.size,
      type: 'svg',
      data: state.url || ' ',
      margin: 10,
      qrOptions: { errorCorrectionLevel: state.errorLevel },
      image: state.logoDataUrl || undefined,
      imageOptions: {
        hideBackgroundDots: state.hideBgDots,
        imageSize: state.logoSize,
        margin: 4,
        crossOrigin: 'anonymous',
      },
      dotsOptions,
      cornersSquareOptions: { type: state.cornerSquareStyle, color: state.cornerColor },
      cornersDotOptions: { type: state.cornerDotStyle, color: state.cornerPupilColor || state.cornerColor },
      backgroundOptions: { color: state.bgColor },
    };
  }

  function applyTemplate(tplId) {
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setS((x) => {
      const next = { ...x, ...tpl.config };
      // Resincroniza esquinas automaticas segun el nuevo dotStyle
      if (tpl.config.dotStyle) {
        if (isCreativeShape(tpl.config.dotStyle)) {
          const def = CREATIVE_DEFAULT_CORNERS[tpl.config.dotStyle];
          if (def) { next.frameStyle = def.frame; next.pupilStyle = def.pupil; }
        } else {
          const def = STD_AUTO_CORNERS[tpl.config.dotStyle];
          if (def) { next.cornerSquareStyle = def.sq; next.cornerDotStyle = def.dot; }
        }
      }
      return next;
    });
  }

  function surpriseMe() {
    const allDotStyles = [...STANDARD_DOT_STYLES, ...CREATIVE_SHAPES.filter((c) => c.value !== 'letter')];
    const pickedDot = allDotStyles[Math.floor(Math.random() * allDotStyles.length)].value;
    const palette = RANDOM_PALETTES[Math.floor(Math.random() * RANDOM_PALETTES.length)];
    const useGrad = Math.random() < 0.4;
    const samePupilColor = Math.random() < 0.5;
    const frameModes = ['none', 'rect', 'rounded', 'card'];
    const pickedFrame = frameModes[Math.floor(Math.random() * frameModes.length)];
    const iconIds = ICONS.filter((i) => i.id !== 'none').map((i) => i.id);
    const pickedIcon = pickedFrame !== 'none' && Math.random() < 0.6
      ? iconIds[Math.floor(Math.random() * iconIds.length)]
      : 'none';

    setS((x) => {
      const next = {
        ...x,
        dotStyle: pickedDot,
        dotColor: palette[0],
        dotColor2: palette[1],
        cornerColor: palette[0],
        cornerPupilColor: samePupilColor ? '' : palette[1],
        useGradient: useGrad,
        frameMode: pickedFrame,
        frameColor: pickedFrame === 'none' ? x.frameColor : '#ffffff',
        cornerIcon: pickedIcon,
        cornerIconColor: palette[1],
      };
      if (isCreativeShape(pickedDot)) {
        const def = CREATIVE_DEFAULT_CORNERS[pickedDot];
        if (def) { next.frameStyle = def.frame; next.pupilStyle = def.pupil; }
      } else {
        const def = STD_AUTO_CORNERS[pickedDot];
        if (def) { next.cornerSquareStyle = def.sq; next.cornerDotStyle = def.dot; }
      }
      return next;
    });
  }

  function onLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      set('logoDataUrl', dataUrl);
      try {
        const palette = await extractPalette(dataUrl, 4);
        setLogoPalette(palette);
      } catch (err) {
        console.warn('No se pudo extraer la paleta del logo:', err);
        setLogoPalette([]);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    set('logoDataUrl', '');
    setLogoPalette([]);
    const input = document.getElementById('qr-logo-input');
    if (input) input.value = '';
  }

  function applyPalette() {
    if (!logoPalette.length) return;
    setS((x) => {
      const next = { ...x, dotColor: logoPalette[0], cornerColor: logoPalette[0] };
      if (logoPalette[1]) {
        next.dotColor2 = logoPalette[1];
        next.useGradient = true;
        next.cornerPupilColor = logoPalette[1];
      }
      return next;
    });
  }

  function onBgImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('bgImageDataUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  function clearBgImage() {
    set('bgImageDataUrl', '');
    const input = document.getElementById('qr-bg-image-input');
    if (input) input.value = '';
  }

  function safeName() {
    try {
      const u = new URL(s.url);
      return ('qr-' + u.hostname.replace(/[^a-z0-9]+/gi, '-')).toLowerCase();
    } catch { return 'qr-conecta-nex'; }
  }

  // El backdrop del logo (addLogoBackdrop) solo se aplica dentro de getQrSvgText;
  // si hay logo con fondo oculto, forzamos SIEMPRE la ruta SVG->PNG para que el
  // archivo exportado sea identico a lo que se ve en la vista previa.
  const logoConBackdrop = !creative && !!s.logoDataUrl && s.hideBgDots;

  async function getQrPngBlob() {
    // Si hay marco, imagen de fondo, creativo o logo con backdrop, vamos por SVG -> PNG.
    if (useFrame || s.bgImageDataUrl || creative || logoConBackdrop) {
      const finalSvg = await getQrSvgText();
      // Si hay marco, el SVG final es mas grande que s.size (incluye padding y headline).
      const outSize = useFrame ? s.size * 1.4 : s.size;
      return svgToPngBlob(finalSvg, outSize);
    }
    const inst = new QRCodeStyling({ ...buildOptions(s), type: 'canvas' });
    return inst.getRawData('png');
  }

  async function getRawQrSvg() {
    if (creative) {
      const { svg } = await renderCustomQR(creativeOpts(s));
      return svg;
    }
    qrRef.current.update(buildOptions(s));
    const blob = await qrRef.current.getRawData('svg');
    return blob.text();
  }

  // El modo creativo ya dibuja su propio fondo/contenedor detras del logo
  // (renderCustomQR). El modo ESTANDAR (qr-code-styling) solo oculta los puntos
  // de fondo pero NO deja ningun contenedor visible: sobre un fondo de color o
  // con un logo con bordes transparentes, el logo queda "flotando" sin marco,
  // menos limpio y menos profesional. Anadimos aqui ese contenedor, leyendo la
  // posicion/tamano reales del <image> que genera la libreria.
  function addLogoBackdrop(svgText, st) {
    const imgMatch = svgText.match(/<image\b[^>]*>/i);
    if (!imgMatch) return svgText;
    const attrs = imgMatch[0];
    const num = (name) => {
      const m = attrs.match(new RegExp(name + '="([\\d.]+)'));
      return m ? parseFloat(m[1]) : null;
    };
    const x = num('x'), y = num('y'), w = num('width'), h = num('height');
    if (x == null || y == null || !w || !h) return svgText;
    const pad = Math.max(w, h) * 0.16;
    const radius = Math.min(w, h) * 0.22;
    const rect = `<rect x="${(x - pad).toFixed(2)}" y="${(y - pad).toFixed(2)}" width="${(w + pad * 2).toFixed(2)}" height="${(h + pad * 2).toFixed(2)}" rx="${radius.toFixed(2)}" fill="${st.bgColor}"/>`;
    return svgText.replace(imgMatch[0], rect + imgMatch[0]);
  }

  async function getQrSvgText() {
    let result = await getRawQrSvg();
    if (!creative && s.logoDataUrl && s.hideBgDots) result = addLogoBackdrop(result, s);
    if (s.bgImageDataUrl) result = wrapWithBgImage(result, s);
    if (s.animateGradient && s.useGradient) result = wrapWithAnimation(result, s);
    if (useFrame) result = wrapWithFrame(result, s);
    return result;
  }

  function wrapWithFrame(qrSvg, st) {
    const vbMatch = qrSvg.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (!vbMatch) return qrSvg;
    const [vx, vy, qrW, qrH] = vbMatch[1].trim().split(/\s+/).map(Number);
    const qrInner = qrSvg
      .replace(/<\?xml[^?]*\?>/g, '')
      .replace(/<svg[^>]*>/i, '')
      .replace(/<\/svg>\s*$/i, '')
      .trim();

    const pad = st.framePadding;
    const headlineH = st.headlineText ? st.headlineSize * 1.8 : 0;
    const footerSize = st.textoTamano * 1.6;
    const footerH = st.texto.trim() ? footerSize * 1.6 : 0;
    const totalW = qrW + pad * 2;
    const totalH = qrH + pad * 2 + headlineH + footerH;

    let frameShape = '';
    const radius = st.frameMode === 'rounded' ? 30 : st.frameMode === 'card' ? 24 : 0;
    if (st.frameMode === 'card') {
      frameShape = `
        <defs>
          <filter id="qrCardShadow" x="-5%" y="-5%" width="115%" height="115%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.18)"/>
          </filter>
        </defs>
        <rect x="0" y="0" width="${totalW}" height="${totalH}" rx="${radius}" fill="${st.frameColor}" filter="url(#qrCardShadow)"/>`;
    } else {
      frameShape = `<rect x="0" y="0" width="${totalW}" height="${totalH}" rx="${radius}" fill="${st.frameColor}"/>`;
    }

    let headlineEl = '';
    if (st.headlineText) {
      const hy = pad * 0.5 + headlineH * 0.5;
      headlineEl = `<text x="${totalW / 2}" y="${hy}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="${st.headlineSize}" fill="${st.headlineColor}" text-anchor="middle" dominant-baseline="central" letter-spacing="2">${escapeXml(st.headlineText)}</text>`;
    }

    let iconEl = '';
    const icon = ICON_BY_ID[st.cornerIcon];
    if (icon && icon.path) {
      const iconSize = 70;
      const ix = totalW - iconSize - pad * 0.35;
      const iy = pad * 0.35;
      const iconScale = iconSize / 600;
      iconEl = `<g transform="translate(${ix}, ${iy}) scale(${iconScale})"><path d="${icon.path}" fill="${st.cornerIconColor}"/></g>`;
    }

    const qrX = pad;
    const qrY = pad + headlineH;

    let footerEl = '';
    if (st.texto.trim()) {
      const fy = qrY + qrH + footerH * 0.55;
      footerEl = `<text x="${totalW / 2}" y="${fy}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="${footerSize}" fill="${st.textoColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(st.texto)}</text>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  ${frameShape}
  ${headlineEl}
  ${iconEl}
  <g transform="translate(${qrX}, ${qrY})">
    <svg x="0" y="0" width="${qrW}" height="${qrH}" viewBox="${vx} ${vy} ${qrW} ${qrH}">
      ${qrInner}
    </svg>
  </g>
  ${footerEl}
</svg>`;
  }

  function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }

  function wrapWithBgImage(svg, st) {
    const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (!vbMatch) return svg;
    const [vx, vy, vw, vh] = vbMatch[1].trim().split(/\s+/).map(Number);
    const imageTag = `<image href="${st.bgImageDataUrl}" x="${vx}" y="${vy}" width="${vw}" height="${vh}" preserveAspectRatio="xMidYMid slice" opacity="${st.bgImageOpacity}"/>`;
    // Insertamos la imagen justo despues del rect de fondo (o despues del <svg> si no hay rect).
    if (/<rect\s[^>]*fill="[^"]*"[^>]*\/>/i.test(svg)) {
      return svg.replace(/(<rect\s[^>]*fill="[^"]*"[^>]*\/>)/i, `$1\n  ${imageTag}`);
    }
    return svg.replace(/(<svg[^>]*>)/i, `$1\n  ${imageTag}`);
  }

  function wrapWithAnimation(svg, st) {
    // Inyecta <animate> en los dos stop del primer linearGradient encontrado.
    const dur = `${st.animationSpeed}s`;
    const c1 = st.dotColor;
    const c2 = st.dotColor2;
    let injected = false;
    return svg.replace(/<stop\b([^/>]*)\/>/gi, (full, attrs) => {
      if (injected && full.includes('animate')) return full;
      const colorMatch = attrs.match(/stop-color\s*=\s*"([^"]+)"/i);
      const offsetMatch = attrs.match(/offset\s*=\s*"([^"]+)"/i);
      if (!colorMatch) return full;
      const offset = offsetMatch ? offsetMatch[1] : '0%';
      const isFirst = offset === '0' || offset === '0%';
      const values = isFirst ? `${c1};${c2};${c1}` : `${c2};${c1};${c2}`;
      injected = true;
      return `<stop${attrs}><animate attributeName="stop-color" values="${values}" dur="${dur}" repeatCount="indefinite"/></stop>`;
    });
  }

  async function exportPNG() {
    if (!s.texto.trim() && !creative && !useFrame && !s.bgImageDataUrl && !logoConBackdrop) {
      const png = new QRCodeStyling({ ...buildOptions(s), type: 'canvas' });
      png.download({ name: safeName(), extension: 'png' });
      return;
    }
    await exportComposed();
  }

  async function exportSVG() {
    const qrSvgText = await getQrSvgText();
    // Con marco, el footer ya esta dentro del SVG y no anadimos wrap externo.
    if (!s.texto.trim() || useFrame) {
      triggerDownload(new Blob([qrSvgText], { type: 'image/svg+xml' }), safeName() + '.svg');
      return;
    }
    const svg = wrapSvgWithText(qrSvgText, s);
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), safeName() + '.svg');
  }

  async function exportPDF() {
    if (!exportableRef.current) return;
    const opt = {
      margin: 10,
      filename: safeName() + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(exportableRef.current).save();
  }

  async function exportComposed() {
    const blob = await getQrPngBlob();
    // Si hay marco, el PNG ya viene completo (con headline + footer + icono). No anadimos nada.
    if (useFrame) {
      triggerDownload(blob, safeName() + '.png');
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = await loadImg(url);

    const hasText = !!s.texto.trim();
    const pad = 60;
    const textH = hasText ? s.textoTamano * 1.8 : 0;
    const W = s.size + pad * 2;
    const H = s.size + pad * 2 + textH;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, pad, pad, s.size, s.size);
    if (hasText) {
      ctx.fillStyle = s.textoColor;
      ctx.font = `600 ${s.textoTamano * 2}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.texto, W / 2, s.size + pad + textH);
    }
    URL.revokeObjectURL(url);

    canvas.toBlob((b) => triggerDownload(b, safeName() + '.png'), 'image/png');
  }

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  function triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function wrapSvgWithText(qrSvg, st) {
    const w = st.size;
    const pad = 40;
    const textH = st.textoTamano * 1.6;
    const totalW = w + pad * 2;
    const totalH = w + pad * 2 + textH;
    const inner = qrSvg
      .replace(/<\?xml[^?]*\?>/g, '')
      .replace(/<svg[^>]*>/, `<g transform="translate(${pad}, ${pad})">`)
      .replace(/<\/svg>/, '</g>');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <rect width="100%" height="100%" fill="${st.bgColor}"/>
  ${inner}
  <text x="${totalW / 2}" y="${w + pad + textH * 0.7}" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-weight="600" font-size="${st.textoTamano}" fill="${st.textoColor}" text-anchor="middle">${escapeXml(st.texto)}</text>
</svg>`;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }

  function reset() {
    if (!confirm('Restablecer todos los valores?')) return;
    setS(DEFAULT_STATE);
    clearLogo();
  }

  return (
    <div>
      <div className="main-header">
        <h1>Generador de QR</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={reset}>Restablecer</button>
          <button className="btn-outline" onClick={exportSVG}>Exportar SVG</button>
          <button className="btn-outline" onClick={exportPDF}>Exportar PDF</button>
          <button className="btn-primary" onClick={exportPNG}>Exportar PNG</button>
        </div>
      </div>

      <div className="qr-layout">
        <div className="card qr-form">
          <h2>Plantillas rapidas</h2>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: -8, marginBottom: 8 }}>
            Un click aplica colores, formas y silueta tematica. Tu URL, logo y texto se mantienen.
          </p>
          <div className="qr-templates">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="qr-template-btn"
                onClick={() => applyTemplate(t.id)}>{t.label}</button>
            ))}
            <button type="button" className="qr-template-btn qr-template-surprise"
              onClick={surpriseMe}>Sorprendeme</button>
          </div>

          <h2 style={{ marginTop: 20 }}>Contenido</h2>
          <label>URL o texto a codificar *</label>
          <input
            value={s.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://..."
          />

          <h2 style={{ marginTop: 20 }}>Texto bajo el QR</h2>
          <label>Mensaje (vacio = sin texto)</label>
          <input
            value={s.texto}
            onChange={(e) => set('texto', e.target.value)}
            placeholder="Escanea para ver el menu"
          />
          <div className="grid" style={{ marginTop: 10 }}>
            <div>
              <label>Tamano texto (px)</label>
              <input type="number" min="10" max="48" value={s.textoTamano}
                onChange={(e) => set('textoTamano', parseInt(e.target.value) || 18)} />
            </div>
            <div>
              <label>Color texto</label>
              <input type="color" value={s.textoColor}
                onChange={(e) => set('textoColor', e.target.value)} />
            </div>
          </div>

          <h2 style={{ marginTop: 20 }}>Colores</h2>
          <div className="grid">
            <div>
              <label>Color principal</label>
              <input type="color" value={s.dotColor}
                onChange={(e) => set('dotColor', e.target.value)} />
            </div>
            <div>
              <label>Color fondo</label>
              <input type="color" value={s.bgColor}
                onChange={(e) => set('bgColor', e.target.value)} />
            </div>
            <div>
              <label>Color marco esquinas</label>
              <input type="color" value={s.cornerColor}
                onChange={(e) => set('cornerColor', e.target.value)} />
            </div>
            <div>
              <label>Color pupila esquinas</label>
              <input type="color" value={s.cornerPupilColor || s.cornerColor}
                onChange={(e) => set('cornerPupilColor', e.target.value)} />
              {s.cornerPupilColor && (
                <button className="btn-outline btn-sm" style={{ marginTop: 4 }}
                  onClick={() => set('cornerPupilColor', '')}>
                  Igual al marco
                </button>
              )}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={s.useGradient}
                  onChange={(e) => set('useGradient', e.target.checked)} />
                Usar gradiente en los puntos
              </label>
            </div>
            {s.useGradient && (
              <div style={{ gridColumn: 'span 2' }}>
                <label>Color secundario (gradiente)</label>
                <input type="color" value={s.dotColor2}
                  onChange={(e) => set('dotColor2', e.target.value)} />
              </div>
            )}
          </div>

          <h2 style={{ marginTop: 20 }}>Estilo</h2>
          <div className="grid">
            <div style={{ gridColumn: 'span 2' }}>
              <label>Forma de los puntos</label>
              <select value={s.dotStyle} onChange={(e) => set('dotStyle', e.target.value)}>
                <optgroup label="Estandar">
                  {STANDARD_DOT_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Creativas">
                  {CREATIVE_SHAPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
            </div>
            {s.dotStyle === 'letter' && (
              <>
                <div>
                  <label>Letra o simbolo</label>
                  <input value={s.letra} maxLength={2}
                    onChange={(e) => set('letra', e.target.value)}
                    placeholder="A" />
                </div>
                <div>
                  <label>Fuente</label>
                  <select value={s.letterFont} onChange={(e) => set('letterFont', e.target.value)}>
                    {LETTER_FONTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </>
            )}
            {!creative ? (
              <>
                <div>
                  <label>Marco de las esquinas</label>
                  <select value={s.cornerSquareStyle} onChange={(e) => set('cornerSquareStyle', e.target.value)}>
                    {CORNER_SQUARE_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Pupila de las esquinas</label>
                  <select value={s.cornerDotStyle} onChange={(e) => set('cornerDotStyle', e.target.value)}>
                    {CORNER_DOT_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label>Marco de las esquinas</label>
                  <select value={s.frameStyle} onChange={(e) => set('frameStyle', e.target.value)}>
                    {CORNER_FRAME_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Pupila de las esquinas</label>
                  <select value={s.pupilStyle} onChange={(e) => set('pupilStyle', e.target.value)}>
                    {PUPIL_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </>
            )}
            <div style={{ gridColumn: 'span 2' }}>
              <label>Nivel de correccion de errores</label>
              <select value={s.errorLevel} onChange={(e) => set('errorLevel', e.target.value)}>
                {ERROR_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {creative && (
            <div className="alerta alerta-aviso" style={{ marginTop: 12 }}>
              <strong>Forma creativa activa.</strong> Quedan muy vistosos pero algunos escaneres viejos pueden tener problemas. Mantieni el nivel <strong>Muy alta (H)</strong> y prueba el QR con varios moviles antes de imprimirlo.
            </div>
          )}

          <h2 style={{ marginTop: 20 }}>Logo central</h2>
          <input id="qr-logo-input" type="file" accept="image/*" onChange={onLogo} />
          {s.logoDataUrl && (
            <>
              {logoPalette.length > 0 && (
                <div className="qr-palette-box" style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>Paleta detectada del logo</label>
                    <button className="btn-primary btn-sm" type="button" onClick={applyPalette}>
                      Aplicar al QR
                    </button>
                  </div>
                  <div className="qr-swatches">
                    {logoPalette.map((c) => (
                      <button key={c} type="button" className="qr-swatch"
                        style={{ background: c }}
                        title={`Click: usar ${c} como color principal`}
                        onClick={() => set('dotColor', c)}>
                        <span>{c}</span>
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--gris-5)', marginTop: 6, marginBottom: 0 }}>
                    Click en un color = lo asigna como principal. <strong>Aplicar al QR</strong> = paleta completa con gradiente y pupila.
                  </p>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <label>Tamano logo ({Math.round(s.logoSize * 100)}%)</label>
                <input type="range" min="0.1" max="0.5" step="0.05" value={s.logoSize}
                  onChange={(e) => set('logoSize', parseFloat(e.target.value))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={s.hideBgDots}
                  onChange={(e) => set('hideBgDots', e.target.checked)} />
                Ocultar puntos detras del logo
              </label>
              <button className="btn-outline btn-sm" style={{ marginTop: 10 }} onClick={clearLogo}>
                Quitar logo
              </button>
            </>
          )}

          <div className="alerta alerta-aviso" style={{ marginTop: 20 }}>
            <strong>Consejo:</strong> si vas a poner logo central, usa correccion <strong>Alta</strong> o <strong>Muy alta</strong> para que el QR siga siendo legible.
          </div>

          <h2 style={{ marginTop: 20 }}>Marco / Cartel</h2>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: -8, marginBottom: 8 }}>
            El QR sigue cuadrado y escaneable al 100%. Le anades un marco con color de marca, titular y un icono opcional en la esquina.
          </p>
          <div className="grid">
            <div style={{ gridColumn: 'span 2' }}>
              <label>Tipo de marco</label>
              <select value={s.frameMode} onChange={(e) => set('frameMode', e.target.value)}>
                {FRAME_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {useFrame && (
            <>
              <div className="grid" style={{ marginTop: 10 }}>
                <div>
                  <label>Color del marco</label>
                  <input type="color" value={s.frameColor}
                    onChange={(e) => set('frameColor', e.target.value)} />
                </div>
                <div>
                  <label>Padding ({s.framePadding}px)</label>
                  <input type="range" min="20" max="120" step="5" value={s.framePadding}
                    onChange={(e) => set('framePadding', parseInt(e.target.value))} />
                </div>
              </div>

              <h3 style={{ marginTop: 16 }}>Titular (encima del QR)</h3>
              <input value={s.headlineText}
                onChange={(e) => set('headlineText', e.target.value)}
                placeholder="MENU DIGITAL, RESERVA TU CITA, VISITA LA WEB..." />
              <div className="grid" style={{ marginTop: 10 }}>
                <div>
                  <label>Tamano ({s.headlineSize}px)</label>
                  <input type="range" min="14" max="56" step="2" value={s.headlineSize}
                    onChange={(e) => set('headlineSize', parseInt(e.target.value))} />
                </div>
                <div>
                  <label>Color</label>
                  <input type="color" value={s.headlineColor}
                    onChange={(e) => set('headlineColor', e.target.value)} />
                </div>
              </div>

              <h3 style={{ marginTop: 16 }}>Icono decorativo en esquina</h3>
              <div className="grid">
                <div>
                  <label>Icono</label>
                  <select value={s.cornerIcon} onChange={(e) => set('cornerIcon', e.target.value)}>
                    {ICONS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Color icono</label>
                  <input type="color" value={s.cornerIconColor}
                    onChange={(e) => set('cornerIconColor', e.target.value)} />
                </div>
              </div>
            </>
          )}

          <h2 style={{ marginTop: 20 }}>Imagen de fondo</h2>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: -8, marginBottom: 8 }}>
            Sube una foto del local, producto o evento. Aparecera detras del QR como cartel completo.
          </p>
          <input id="qr-bg-image-input" type="file" accept="image/*" onChange={onBgImage} />
          {s.bgImageDataUrl && (
            <>
              <div style={{ marginTop: 10 }}>
                <label>Opacidad de la imagen ({Math.round(s.bgImageOpacity * 100)}%)</label>
                <input type="range" min="0.1" max="1" step="0.05" value={s.bgImageOpacity}
                  onChange={(e) => set('bgImageOpacity', parseFloat(e.target.value))} />
              </div>
              <button className="btn-outline btn-sm" style={{ marginTop: 10 }} onClick={clearBgImage}>
                Quitar imagen
              </button>
              <div className="alerta alerta-aviso" style={{ marginTop: 12 }}>
                <strong>Importante:</strong> el QR sigue teniendo su fondo blanco (color de fondo del QR) para garantizar escaneo. La foto se ve alrededor. Baja la opacidad si quieres que la foto sea mas sutil.
              </div>
            </>
          )}

          <h2 style={{ marginTop: 20 }}>Animacion (pantallas digitales)</h2>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: -8, marginBottom: 8 }}>
            Solo funciona con gradiente activo. La animacion se conserva al exportar SVG, no en PNG/PDF (esos son fotogramas estaticos).
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" style={{ width: 'auto' }}
              checked={s.animateGradient}
              disabled={!s.useGradient}
              onChange={(e) => set('animateGradient', e.target.checked)} />
            Animar gradiente {!s.useGradient && <em style={{ color: 'var(--gris-4)', fontSize: 11 }}>(activa el gradiente arriba primero)</em>}
          </label>
          {s.animateGradient && s.useGradient && (
            <div style={{ marginTop: 10 }}>
              <label>Velocidad del ciclo ({s.animationSpeed}s por vuelta)</label>
              <input type="range" min="1" max="15" step="0.5" value={s.animationSpeed}
                onChange={(e) => set('animationSpeed', parseFloat(e.target.value))} />
              <div className="alerta alerta-ok" style={{ marginTop: 8 }}>
                <strong>QR animado.</strong> Exporta SVG y subelo a una pantalla digital, web, signage TPV. Los colores cicleran automaticamente entre el principal y el secundario.
              </div>
            </div>
          )}
        </div>

        <div className="card qr-preview-card">
          <h2>Vista previa</h2>
          <div ref={exportableRef} className="qr-exportable" style={{ background: s.bgColor }}>
            <div ref={qrContainer} className="qr-preview" />
            {!useFrame && s.texto.trim() && (
              <div
                className="qr-text"
                style={{ color: s.textoColor, fontSize: s.textoTamano }}
              >
                {s.texto}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: 12, textAlign: 'center' }}>
            La vista previa refleja exactamente lo que se exportara.
          </p>
        </div>
      </div>
    </div>
  );
}
