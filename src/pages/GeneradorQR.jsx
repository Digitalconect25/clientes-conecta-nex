import { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import html2pdf from 'html2pdf.js';

const DOT_STYLES = [
  { value: 'square', label: 'Cuadrado clasico' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'dots', label: 'Puntos' },
  { value: 'classy', label: 'Elegante' },
  { value: 'classy-rounded', label: 'Elegante redondeado' },
  { value: 'extra-rounded', label: 'Extra redondeado' },
];

const CORNER_SQUARE_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'dot', label: 'Punto' },
  { value: 'extra-rounded', label: 'Extra redondeado' },
];

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'dot', label: 'Punto' },
];

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
  useGradient: false,
  dotColor: '#000000',
  dotColor2: '#047857',
  cornerColor: '#000000',
  bgColor: '#ffffff',
  errorLevel: 'H',
  logoDataUrl: '',
  logoSize: 0.35,
  hideBgDots: true,
  texto: 'Escanea para ver el menu',
  textoTamano: 18,
  textoColor: '#1f2937',
};

export default function GeneradorQR() {
  const [s, setS] = useState(DEFAULT_STATE);
  const qrRef = useRef(null);
  const qrContainer = useRef(null);
  const exportableRef = useRef(null);

  function set(k, v) { setS((x) => ({ ...x, [k]: v })); }

  useEffect(() => {
    qrRef.current = new QRCodeStyling(buildOptions(s));
    if (qrContainer.current) {
      qrContainer.current.innerHTML = '';
      qrRef.current.append(qrContainer.current);
    }
    return () => { if (qrContainer.current) qrContainer.current.innerHTML = ''; };
  }, []);

  useEffect(() => {
    if (qrRef.current) qrRef.current.update(buildOptions(s));
  }, [s]);

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
      cornersDotOptions: { type: state.cornerDotStyle, color: state.cornerColor },
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

  function safeName() {
    try {
      const u = new URL(s.url);
      return ('qr-' + u.hostname.replace(/[^a-z0-9]+/gi, '-')).toLowerCase();
    } catch { return 'qr-conecta-nex'; }
  }

  async function exportPNG() {
    if (!s.texto.trim()) {
      const png = new QRCodeStyling({ ...buildOptions(s), type: 'canvas' });
      png.download({ name: safeName(), extension: 'png' });
      return;
    }
    await exportComposed('png');
  }

  async function exportSVG() {
    if (!s.texto.trim()) {
      qrRef.current.download({ name: safeName(), extension: 'svg' });
      return;
    }
    const blob = await qrRef.current.getRawData('svg');
    const qrSvgText = await blob.text();
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

  async function exportComposed(format) {
    const qrCanvasInst = new QRCodeStyling({ ...buildOptions(s), type: 'canvas' });
    const blob = await qrCanvasInst.getRawData('png');
    const url = URL.createObjectURL(blob);
    const img = await loadImg(url);

    const pad = 60;
    const textH = s.textoTamano * 1.8;
    const W = s.size + pad * 2;
    const H = s.size + pad * 2 + textH;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, pad, pad, s.size, s.size);
    ctx.fillStyle = s.textoColor;
    ctx.font = `600 ${s.textoTamano * 2}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.texto, W / 2, s.size + pad + textH);
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
              <label>Color esquinas</label>
              <input type="color" value={s.cornerColor}
                onChange={(e) => set('cornerColor', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={s.useGradient}
                  onChange={(e) => set('useGradient', e.target.checked)} />
                Usar gradiente
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
                {DOT_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label>Esquinas (cuadrado)</label>
              <select value={s.cornerSquareStyle} onChange={(e) => set('cornerSquareStyle', e.target.value)}>
                {CORNER_SQUARE_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label>Esquinas (punto)</label>
              <select value={s.cornerDotStyle} onChange={(e) => set('cornerDotStyle', e.target.value)}>
                {CORNER_DOT_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Nivel de correccion de errores</label>
              <select value={s.errorLevel} onChange={(e) => set('errorLevel', e.target.value)}>
                {ERROR_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

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
