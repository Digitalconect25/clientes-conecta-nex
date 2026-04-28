import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function FirmaCanvas({ onFirmar, onCancelar }) {
  const sigRef = useRef(null);
  const [vacio, setVacio] = useState(true);

  function limpiar() {
    sigRef.current?.clear();
    setVacio(true);
  }

  function confirmar() {
    if (sigRef.current?.isEmpty()) {
      alert('Por favor firma antes de confirmar');
      return;
    }
    const dataURL = sigRef.current.getCanvas().toDataURL('image/png');
    onFirmar(dataURL);
  }

  return (
    <div>
      <p style={{ fontSize: 13, marginBottom: 10, color: 'var(--gris-5)' }}>
        Firma con el raton o con el dedo (si usas tablet/movil) en el cuadro de abajo.
      </p>
      <div className="firma-canvas-wrapper">
        <SignatureCanvas
          ref={sigRef}
          penColor="#1a1a1a"
          backgroundColor="rgba(255,255,255,1)"
          canvasProps={{ width: 700, height: 200 }}
          onBegin={() => setVacio(false)}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn-outline" onClick={limpiar}>Limpiar</button>
        <button className="btn-outline" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary" onClick={confirmar} disabled={vacio}>Confirmar firma</button>
      </div>
    </div>
  );
}
