// Piezas comunes de Offer Lab. Portadas de ~/smart-offer-lab/src/ui.tsx.
// Aquella app usa Tailwind; aqui las mismas clases estan escritas a mano en
// src/styles/offerlab.css. El aspecto y el comportamiento son los de siempre.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { fechaLarga, money } from '../lib/offerlab.js';

const TONOS = {
  negro: 'bg-tinta',
  amarillo: 'bg-amarillo',
  azul: 'bg-azul',
  papel: 'bg-papel',
};

export function Boton({ tono = 'papel', className = '', children, ...props }) {
  return (
    <button
      {...props}
      className={`b2 dura-sm pulsable t-micro negra mayus track-sm ${TONOS[tono]} ${className}`}
      style={{ minHeight: 44, padding: '0 16px', letterSpacing: '0.08em', ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

export function Etiqueta({ children }) {
  return <span className="t-micro negra mayus track" style={{ display: 'block', marginBottom: 4 }}>{children}</span>;
}

/**
 * Campo numerico con texto propio mientras se escribe.
 * Antes leia `valueAsNumber` en cada tecla: al teclear el separador decimal de
 * «49,99» el valor era NaN, caia a 0 y borraba lo escrito. Ahora se teclea
 * libre (con coma o punto) y solo se publica el numero cuando es valido.
 */
export function Numero({ valor, onCambio, unidad, min = 0, max, ancho = '100%', etiqueta }) {
  const [texto, setTexto] = useState(() => String(valor ?? 0));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(String(Number.isFinite(valor) ? valor : 0));
  }, [valor, editando]);

  const acotar = useCallback(
    (n) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, n)),
    [min, max],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', width: ancho }}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={etiqueta}
        value={texto}
        onFocus={(e) => { setEditando(true); e.currentTarget.select(); }}
        onChange={(e) => {
          const t = e.currentTarget.value;
          setTexto(t);
          if (t.trim() === '') return onCambio(0);
          const n = parseFloat(t.replace(',', '.'));
          if (Number.isFinite(n)) onCambio(acotar(n));
        }}
        onBlur={() => {
          setEditando(false);
          // Al salir, el texto refleja el numero que de verdad se ha guardado.
          const n = parseFloat(texto.replace(',', '.'));
          setTexto(String(Number.isFinite(n) ? acotar(n) : Number.isFinite(valor) ? valor : 0));
        }}
        className="t-cuerpo cifras"
        style={{ height: 44, width: '100%', minWidth: 0, fontWeight: 700 }}
      />
      {unidad && (
        <span aria-hidden className="b2 bg-tinta t-micro negra" style={{ marginLeft: -2, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          {unidad}
        </span>
      )}
    </div>
  );
}

export function Texto({ valor, onCambio, placeholder, etiqueta, tipo = 'text', className = '' }) {
  return (
    <input
      type={tipo}
      value={valor || ''}
      placeholder={placeholder}
      aria-label={etiqueta}
      onChange={(e) => onCambio(e.currentTarget.value)}
      className={`t-cuerpo ${className}`}
      style={{ height: 44, width: '100%', fontWeight: 700 }}
    />
  );
}

export function AreaTexto({ valor, onCambio, placeholder, filas = 3, etiqueta }) {
  return (
    <textarea
      value={valor || ''}
      rows={filas}
      placeholder={placeholder}
      aria-label={etiqueta}
      onChange={(e) => onCambio(e.currentTarget.value)}
      className="t-cuerpo"
      style={{ width: '100%', resize: 'none', fontWeight: 500, lineHeight: 1.35 }}
    />
  );
}

/** Barra de anadir. Con etiqueta real: el placeholder no la sustituye. */
export function Anadir({ placeholder, textoBoton, onAnadir }) {
  const [valor, setValor] = useState('');
  const id = useId();
  const confirmar = () => {
    if (!valor.trim()) return;
    onAnadir(valor);
    setValor('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, maxWidth: 512 }}>
      <label htmlFor={id} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {placeholder}
      </label>
      <input
        id={id}
        type="text"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => setValor(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
        className="t-cuerpo"
        style={{ height: 44, flex: 1, minWidth: 0, fontWeight: 700 }}
      />
      <Boton tono="amarillo" onClick={confirmar} style={{ flexShrink: 0 }}>{textoBoton}</Boton>
    </div>
  );
}

/** Descarga en PNG el nodo referenciado. Lo que lleve `no-png` se queda fuera. */
export function useDescargaPng(nombreArchivo) {
  const ref = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const descargar = useCallback(async () => {
    const nodo = ref.current;
    if (!nodo || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      // Diferido: 'html-to-image' solo baja cuando alguien exporta de verdad.
      const { toPng } = await import('html-to-image');
      const url = await toPng(nodo, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (n) => !(n instanceof HTMLElement && n.classList.contains('no-png')),
      });
      const a = document.createElement('a');
      a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.png`;
      a.href = url;
      a.click();
    } catch (err) {
      console.error('No se pudo generar el PNG', err);
      setError('No se pudo generar la imagen. Intentelo otra vez.');
    } finally {
      setOcupado(false);
    }
  }, [nombreArchivo, ocupado]);

  return { ref, descargar, ocupado, error };
}

export function BotonPng({ onClick, ocupado, error }) {
  return (
    /* `mantener`: fuera de la imagen, pero sigue a mano mientras presenta. */
    <div className="no-png mantener" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <Boton tono="azul" onClick={onClick} disabled={ocupado}>
        {ocupado ? 'Generando…' : '↓ Descargar PNG'}
      </Boton>
      {error && <p role="alert" className="b2 bg-amarillo t-micro negra mayus" style={{ padding: '4px 8px', margin: 0 }}>{error}</p>}
    </div>
  );
}

/**
 * Membrete que va DENTRO de la imagen exportada: sin esto el PNG es un
 * pantallazo anonimo y no se sabe de que cliente ni de que dia es.
 */
export function Membrete({ cliente, titulo, fecha }) {
  return (
    <div
      className="b2 bg-tinta"
      style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 24, rowGap: 4, padding: '10px 16px' }}
    >
      <span className="t-rotulo negra mayus" style={{ lineHeight: 1, letterSpacing: '-0.02em' }}>{cliente}</span>
      <span className="t-dato" style={{ fontWeight: 500 }}>{titulo} · {fechaLarga(fecha)}</span>
    </div>
  );
}

export function Titular({ titulo, apunte, derecha }) {
  return (
    <div
      style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: 24, rowGap: 12, borderBottom: '2px solid #000', paddingBottom: 12 }}
    >
      <div>
        <h2 className="t-seccion negra mayus" style={{ margin: 0, lineHeight: 0.88, letterSpacing: '-0.035em' }}>{titulo}</h2>
        {/* El apunte es la instruccion de uso: ayuda mientras trabaja, sobra
            cuando gira la pantalla. */}
        {apunte && <p className="no-png t-dato" style={{ margin: '8px 0 0', fontWeight: 500 }}>{apunte}</p>}
      </div>
      {derecha}
    </div>
  );
}

/** Cifra grande con su rotulo. Es el bloque que el cliente mira en pantalla. */
export function Cifra({ rotulo, valor, tono = 'papel', grande = false }) {
  return (
    <div className={`b2 ${TONOS[tono]}`} style={{ padding: '12px 16px' }}>
      <span className="t-micro negra mayus track" style={{ display: 'block' }}>{rotulo}</span>
      <span className={`negra cifras ${grande ? 't-seccion' : 't-cifra'}`} style={{ display: 'block', marginTop: 4, lineHeight: 1 }}>
        {typeof valor === 'number' ? money(valor) : valor}
      </span>
    </div>
  );
}

export function Vacio({ titulo, pista }) {
  return (
    <div className="b2 bg-papel" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p className="t-rotulo negra mayus" style={{ margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{titulo}</p>
      <p className="t-dato" style={{ margin: '8px auto 0', maxWidth: 384, fontWeight: 500 }}>{pista}</p>
    </div>
  );
}
