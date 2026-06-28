import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

// Acepta dos APIs:
// - onChange(dataURL): se llama en cada trazo y al limpiar. La firma se va
//   guardando sola, no hace falta pulsar "Confirmar firma".
// - onFirmar(dataURL) + onCancelar(): API antigua con botones explicitos.
// Si pasas onChange, ocultamos los botones "Confirmar firma" y "Cancelar"
// porque el flujo es continuo y la firma se queda guardada al soltar.
export default function FirmaCanvas({ onFirmar, onCancelar, onChange }) {
  const sigRef = useRef(null);
  const [vacio, setVacio] = useState(true);

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
        Firma con el raton o con el dedo (si usas tablet/movil) en el cuadro de abajo.
      </p>
      <div className="firma-canvas-wrapper">
        <SignatureCanvas
          ref={sigRef}
          penColor="#0b3d2e"
          backgroundColor="rgba(255,255,255,1)"
          minWidth={0.7}
          maxWidth={2.6}
          velocityFilterWeight={0.8}
          dotSize={1.4}
          throttle={8}
          canvasProps={{ width: 700, height: 200, style: { width: '100%', height: 'auto', touchAction: 'none', display: 'block' } }}
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
