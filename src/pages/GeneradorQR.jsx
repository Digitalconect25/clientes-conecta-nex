import { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import html2pdf from 'html2pdf.js';
import { CREATIVE_SHAPES, FRAME_STYLES, PUPIL_STYLES, isCreativeShape, renderCustomQR, svgToPngBlob } from '../lib/customQR.js';
import { SILHOUETTES, letterSilhouette } from '../lib/qrSilhouettes.js';
import { composeQrInSilhouette } from '../lib/qrFrame.js';

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

const DEFAULT_STATE = {
  url: 'https://conectanex.com',
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
  silhouetteMode: 'none',
  silhouetteId: 'triangle',
  silhouetteFill: '',
  silhouetteLetter: 'A',
  silhouetteLetterFont: 'Arial Black, sans-serif',
  customSilhouetteSvg: '',
  customQrScale: 0.45,
  customQrOffsetX: 0,
  customQrOffsetY: 0,
};

export default function GeneradorQR() {
  const [s, setS] = useState(DEFAULT_STATE);
  const qrRef = useRef(null);
  const qrContainer = useRef(null);
  const exportableRef = useRef(null);
  const lastCreativeSvgRef = useRef('');

  const creative = isCreativeShape(s.dotStyle);
  const useSilhouette = s.silhouetteMode !== 'none';

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
      const qrSvg = await getQrSvgText();
      const finalSvg = useSilhouette ? composeWithSilhouette(qrSvg) : qrSvg;
      if (!cancelled && qrContainer.current) {
        qrContainer.current.innerHTML = finalSvg;
      }
    }
    render().catch(console.error);
    return () => { cancelled = true; };
  }, [s, creative, useSilhouette]);

  function composeWithSilhouette(qrSvgText) {
    if (s.silhouetteMode === 'gallery') {
      const sil = SILHOUETTES.find((x) => x.id === s.silhouetteId) || SILHOUETTES[0];
      return composeQrInSilhouette({
        qrSvgText,
        silhouette: sil,
        silhouetteFill: s.silhouetteFill || sil.defaultFill,
        bgColor: s.bgColor,
      });
    }
    if (s.silhouetteMode === 'letter') {
      const sil = letterSilhouette(s.silhouetteLetter, s.silhouetteLetterFont);
      return composeQrInSilhouette({
        qrSvgText,
        silhouette: sil,
        silhouetteFill: s.silhouetteFill || sil.defaultFill,
        bgColor: s.bgColor,
      });
    }
    if (s.silhouetteMode === 'custom') {
      if (!s.customSilhouetteSvg) return qrSvgText;
      const parsedViewBox = extractViewBoxQuick(s.customSilhouetteSvg);
      const [, , w, h] = parsedViewBox;
      const side = Math.min(w, h) * s.customQrScale;
      const cx = w / 2 + s.customQrOffsetX;
      const cy = h / 2 + s.customQrOffsetY;
      return composeQrInSilhouette({
        qrSvgText,
        silhouette: { defaultFill: '#000' },
        customSvgText: s.customSilhouetteSvg,
        customQrBox: { x: cx - side / 2, y: cy - side / 2, size: side },
        bgColor: s.bgColor,
      });
    }
    return qrSvgText;
  }

  function extractViewBoxQuick(svg) {
    const m = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (m) return m[1].trim().split(/\s+/).map(Number);
    return [0, 0, 600, 600];
  }

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

  function onLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', reader.result);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    set('logoDataUrl', '');
    const input = document.getElementById('qr-logo-input');
    if (input) input.value = '';
  }

  function onCustomSilhouette(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('customSilhouetteSvg', String(reader.result));
    reader.readAsText(file);
  }

  function safeName() {
    try {
      const u = new URL(s.url);
      return ('qr-' + u.hostname.replace(/[^a-z0-9]+/gi, '-')).toLowerCase();
    } catch { return 'qr-conecta-nex'; }
  }

  async function getQrPngBlob() {
    if (useSilhouette) {
      const qrSvg = await getRawQrSvg();
      const composed = composeWithSilhouette(qrSvg);
      return svgToPngBlob(composed, s.size);
    }
    if (creative) {
      const { svg, size } = await renderCustomQR(creativeOpts(s));
      return svgToPngBlob(svg, Math.max(s.size, size));
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

  async function getQrSvgText() {
    const raw = await getRawQrSvg();
    return useSilhouette ? composeWithSilhouette(raw) : raw;
  }

  async function exportPNG() {
    if (!s.texto.trim() && !creative) {
      const png = new QRCodeStyling({ ...buildOptions(s), type: 'canvas' });
      png.download({ name: safeName(), extension: 'png' });
      return;
    }
    await exportComposed();
  }

  async function exportSVG() {
    const qrSvgText = await getQrSvgText();
    if (!s.texto.trim()) {
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
          <h2>Contenido</h2>
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
                    {FRAME_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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

          <h2 style={{ marginTop: 20 }}>Silueta del QR</h2>
          <p style={{ fontSize: 12, color: 'var(--gris-5)', marginTop: -8, marginBottom: 8 }}>
            El QR escaneable se incrusta dentro de una forma decorativa. La forma rodea, el QR funciona.
          </p>
          <label>Modo</label>
          <select value={s.silhouetteMode} onChange={(e) => set('silhouetteMode', e.target.value)}>
            <option value="none">Ninguna (QR cuadrado normal)</option>
            <option value="gallery">Galeria predefinida</option>
            <option value="letter">Letra grande como silueta</option>
            <option value="custom">Subir mi propio SVG</option>
          </select>

          {s.silhouetteMode === 'gallery' && (
            <div className="grid" style={{ marginTop: 10 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Silueta</label>
                <select value={s.silhouetteId} onChange={(e) => set('silhouetteId', e.target.value)}>
                  {SILHOUETTES.map((sil) => <option key={sil.id} value={sil.id}>{sil.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Color silueta (vacio = color de la marca)</label>
                <input type="color" value={s.silhouetteFill || (SILHOUETTES.find((x) => x.id === s.silhouetteId)?.defaultFill || '#000000')}
                  onChange={(e) => set('silhouetteFill', e.target.value)} />
                <button className="btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => set('silhouetteFill', '')}>
                  Usar color por defecto
                </button>
              </div>
            </div>
          )}

          {s.silhouetteMode === 'letter' && (
            <div className="grid" style={{ marginTop: 10 }}>
              <div>
                <label>Letra (1-2 caracteres)</label>
                <input value={s.silhouetteLetter} maxLength={2}
                  onChange={(e) => set('silhouetteLetter', e.target.value)} placeholder="M" />
              </div>
              <div>
                <label>Fuente</label>
                <select value={s.silhouetteLetterFont} onChange={(e) => set('silhouetteLetterFont', e.target.value)}>
                  {LETTER_FONTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Color letra</label>
                <input type="color" value={s.silhouetteFill || '#1f2937'}
                  onChange={(e) => set('silhouetteFill', e.target.value)} />
              </div>
            </div>
          )}

          {s.silhouetteMode === 'custom' && (
            <div style={{ marginTop: 10 }}>
              <label>Sube un SVG (logo, mascota, forma…)</label>
              <input type="file" accept=".svg,image/svg+xml" onChange={onCustomSilhouette} />
              {s.customSilhouetteSvg && (
                <>
                  <div className="grid" style={{ marginTop: 10 }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label>Tamano del QR ({Math.round(s.customQrScale * 100)}%)</label>
                      <input type="range" min="0.2" max="0.85" step="0.05" value={s.customQrScale}
                        onChange={(e) => set('customQrScale', parseFloat(e.target.value))} />
                    </div>
                    <div>
                      <label>Desplazamiento X ({s.customQrOffsetX})</label>
                      <input type="range" min="-200" max="200" step="5" value={s.customQrOffsetX}
                        onChange={(e) => set('customQrOffsetX', parseInt(e.target.value))} />
                    </div>
                    <div>
                      <label>Desplazamiento Y ({s.customQrOffsetY})</label>
                      <input type="range" min="-200" max="200" step="5" value={s.customQrOffsetY}
                        onChange={(e) => set('customQrOffsetY', parseInt(e.target.value))} />
                    </div>
                  </div>
                  <button className="btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => set('customSilhouetteSvg', '')}>
                    Quitar SVG
                  </button>
                </>
              )}
              <p style={{ fontSize: 11, color: 'var(--gris-5)', marginTop: 6 }}>
                Tip: usa un SVG con relleno solido en una sola pieza (logo, mascota, letra). Los SVG con muchas capas o texto pueden no escalar bien.
              </p>
            </div>
          )}

          {useSilhouette && (
            <div className="alerta alerta-aviso" style={{ marginTop: 12 }}>
              <strong>Silueta activa.</strong> El QR escaneable queda incrustado dentro con un fondo blanco de seguridad. Imprime el QR a buen tamano (minimo 3 cm de lado para el cuadrado interior) y prueba antes de tirar miles.
            </div>
          )}
        </div>

        <div className="card qr-preview-card">
          <h2>Vista previa</h2>
          <div ref={exportableRef} className="qr-exportable" style={{ background: s.bgColor }}>
            <div ref={qrContainer} className="qr-preview" />
            {s.texto.trim() && (
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
