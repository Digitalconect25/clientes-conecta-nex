import { useRef, useState, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';

// Acepta dos APIs:
// - onChange(dataURL): se llama en cada trazo y al limpiar. La firma se va
//   guardando sola, no hace falta pulsar "Confirmar firma".
// - onFirmar(dataURL) + onCancelar(): API antigua con botones explicitos.
// Si pasas onChange, ocultamos los botones "Confirmar firma" y "Cancelar"
// porque el flujo es continuo y la firma se queda guardada al soltar.
export default function FirmaCanvas({ onFirmar, onCancelar, onChange }) {
  const sigRef = useRef(null);
  const wrapRef = useRef(null);
  const aplicado = useRef({ w: 0, h: 0 });
  const [vacio, setVacio] = useState(true);

  // Ajusta el lienzo al tamaño REAL del recuadro (y a la densidad de pantalla).
  // Sin esto, el canvas tiene una resolucion interna fija (700x200) pero se
  // muestra estirado, asi que las coordenadas del dedo no coinciden con el
  // trazo y la firma se corta o se desplaza.
  const ajustar = useCallback((forzar) => {
    const canvas = sigRef.current?.getCanvas();
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    if (!forzar && Math.abs(w - aplicado.current.w) < 2 && Math.abs(h - aplicado.current.h) < 2) return;
    aplicado.current = { w, h };
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio); // dibujamos en coordenadas CSS; el contexto escala a pixeles reales
    sigRef.current.clear();   // cambiar width/height vacia el lienzo: dejamos fondo limpio
    setVacio(true);
    if (onChange) onChange(null);
  }, [onChange]);

  useEffect(() => {
    ajustar(true);
    const onResize = () => ajustar(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [ajustar]);

  function getDataURL() {
    if (!sigRef.current || sigRef.current.isEmpty()) return null;
    return sigRef.current.getCanvas().toDataURL('image/png');
  }

  function limpiar() {
    sigRef.current?.clear();
    setVacio(true);
    if (onChange) onChange(null);
  }

  function alSoltar() {
    setVacio(sigRef.current?.isEmpty() ?? true);
    if (onChange) {
      const dataURL = getDataURL();
      onChange(dataURL);
    }
  }

  function confirmar() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Por favor firma antes de confirmar');
      return;
    }
    const dataURL = getDataURL();
    if (onFirmar) onFirmar(dataURL);
  }

  const usaOnChange = typeof onChange === 'function';

  return (
    <div>
      <p style={{ fontSize: 13, marginBottom: 10, color: 'var(--gris-5)' }}>
        Firma con el dedo (movil/tablet) o con el raton dentro del recuadro.
      </p>
      <div
        ref={wrapRef}
        className="firma-canvas-wrapper"
        style={{ width: '100%', height: 200, touchAction: 'none', overflow: 'hidden' }}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="#0b3d2e"
          backgroundColor="rgba(255,255,255,1)"
          minWidth={0.7}
          maxWidth={2.6}
          velocityFilterWeight={0.8}
          dotSize={1.4}
          throttle={8}
          canvasProps={{ style: { display: 'block', width: '100%', height: '100%', touchAction: 'none' } }}
          onBegin={() => setVacio(false)}
          onEnd={alSoltar}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn-outline" onClick={limpiar}>Limpiar</button>
        {!usaOnChange && (
          <>
            {onCancelar && <button className="btn-outline" onClick={onCancelar}>Cancelar</button>}
            <button className="btn-primary" onClick={confirmar} disabled={vacio}>Confirmar firma</button>
          </>
        )}
        {usaOnChange && !vacio && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#047857' }}>
            ✓ Firma capturada
          </span>
        )}
      </div>
    </div>
  );
}
