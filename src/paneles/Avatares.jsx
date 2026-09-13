// Mapa de avatares · portado de ~/smart-offer-lab/src/paneles/Avatares.tsx
// Cuanto mas cerca del centro, mas interesa ese cliente. Se arrastra con el
// dedo o el raton, y tambien se mueve con las flechas del teclado.
import { useRef, useState } from 'react';
import { Anadir, AreaTexto, Boton, BotonPng, Etiqueta, Membrete, Texto, Titular, useDescargaPng } from './ui.jsx';
import { anilloDe } from '../lib/offerlab.js';

/** Anillos del mapa, de dentro a fuera. El diametro va en % del lado del cuadro. */
const ANILLOS = [
  { d: 34, etiqueta: 'Cliente ideal' },
  { d: 64, etiqueta: 'Afin' },
  { d: 94, etiqueta: 'Lejano' },
];

const CAMPOS = [
  { clave: 'dolor', etiqueta: 'Su dolor' },
  { clave: 'sueno', etiqueta: 'Su sueno' },
  { clave: 'no', etiqueta: 'Que le hace decir NO' },
  { clave: 'si', etiqueta: 'Que le hace decir SI' },
];

const tope = (n) => Math.min(94, Math.max(6, n));

export function Avatares({ avatares, addAvatar, setAvatar, quitarAvatar, cliente, fecha }) {
  const { ref, descargar, ocupado, error } = useDescargaPng('mapa-de-avatares');
  const mapaRef = useRef(null);
  const arrastre = useRef(null);
  const [temp, setTemp] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [anuncio, setAnuncio] = useState('');

  const seleccionado = avatares.find((a) => a.id === abierto) ?? null;

  function alPulsar(e, av) {
    // Un segundo dedo apoyado no debe secuestrar el arrastre en curso.
    if (arrastre.current) return;
    const caja = mapaRef.current?.getBoundingClientRect();
    if (!caja) return;
    const px = caja.left + ((av.x ?? 50) / 100) * caja.width;
    const py = caja.top + ((av.y ?? 50) / 100) * caja.height;
    arrastre.current = { id: av.id, pointerId: e.pointerId, dx: e.clientX - px, dy: e.clientY - py, x0: e.clientX, y0: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function alMover(e) {
    const a = arrastre.current;
    if (!a || a.pointerId !== e.pointerId) return;
    const caja = mapaRef.current?.getBoundingClientRect();
    if (!caja) return;
    setTemp({
      id: a.id,
      x: tope(((e.clientX - a.dx - caja.left) / caja.width) * 100),
      y: tope(((e.clientY - a.dy - caja.top) / caja.height) * 100),
    });
  }

  function alSoltar(e, av) {
    const a = arrastre.current;
    if (!a || a.pointerId !== e.pointerId) return;
    arrastre.current = null;
    const recorrido = Math.hypot(e.clientX - a.x0, e.clientY - a.y0);
    if (recorrido < 5) {
      setAbierto((v) => (v === av.id ? null : av.id)); // ha sido un clic, no un arrastre
    } else if (temp && temp.id === av.id) {
      setAvatar(av.id, { x: temp.x, y: temp.y });
    }
    setTemp(null);
  }

  /** El sistema puede cancelar el puntero: sin esto la tarjeta se queda donde no esta. */
  function alCancelar(e) {
    if (arrastre.current?.pointerId !== e.pointerId) return;
    arrastre.current = null;
    setTemp(null);
  }

  /** Mover con el teclado: el mapa entero era inalcanzable sin raton. */
  function alTeclear(e, av) {
    const paso = e.shiftKey ? 6 : 2;
    const mapa = { ArrowUp: [0, -paso], ArrowDown: [0, paso], ArrowLeft: [-paso, 0], ArrowRight: [paso, 0] };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setAbierto((v) => (v === av.id ? null : av.id));
      return;
    }
    const delta = mapa[e.key];
    if (!delta) return;
    e.preventDefault();
    const x = tope((av.x ?? 50) + delta[0]);
    const y = tope((av.y ?? 50) + delta[1]);
    setAvatar(av.id, { x, y });
    setAnuncio(`${av.nombre}: anillo ${anilloDe(x, y)}`);
  }

  return (
    <section>
      <Titular
        titulo="Mapa de avatares"
        apunte="Cuanto mas cerca del centro, mas le interesa ese cliente. Arrastre, o muevalos con las flechas."
        derecha={<BotonPng onClick={descargar} ocupado={ocupado} error={error} />}
      />

      <div className="no-png" style={{ marginBottom: 24 }}>
        <Anadir placeholder="Tipo de cliente…" textoBoton="+ Anadir avatar" onAnadir={addAvatar} />
      </div>

      {/* Al mover con las flechas, quien usa lector de pantalla oye en que
          anillo ha quedado; sin esto el mapa era inservible sin vista. */}
      <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{anuncio}</p>

      <div style={{ display: 'grid', alignItems: 'start', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div ref={ref} className="bg-papel">
          <Membrete cliente={cliente} titulo="Mapa de avatares" fecha={fecha} />
          <div
            ref={mapaRef}
            tabIndex={-1}
            style={{ position: 'relative', margin: '0 auto', aspectRatio: '1 / 1', width: '100%', maxWidth: 544, userSelect: 'none', outline: 'none' }}
            onPointerMove={alMover}
          >
            {ANILLOS.map((anillo) => (
              <div
                key={anillo.d}
                className="b2"
                style={{ pointerEvents: 'none', position: 'absolute', left: '50%', top: '50%', borderRadius: '50%', width: `${anillo.d}%`, height: `${anillo.d}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span
                  className="bg-papel t-micro negra mayus track"
                  style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap', padding: '0 8px' }}
                >
                  {anillo.etiqueta}
                </span>
              </div>
            ))}

            <div aria-hidden className="bg-tinta" style={{ pointerEvents: 'none', position: 'absolute', left: '50%', top: '50%', height: 12, width: 12, transform: 'translate(-50%, -50%)' }} />

            {avatares.map((av) => {
              const pos = temp && temp.id === av.id ? temp : av;
              const activo = abierto === av.id;
              const moviendo = temp?.id === av.id;
              return (
                <div
                  key={av.id}
                  onPointerDown={(e) => alPulsar(e, av)}
                  onPointerUp={(e) => alSoltar(e, av)}
                  onPointerCancel={alCancelar}
                  onKeyDown={(e) => alTeclear(e, av)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${av.nombre}. Flechas para moverlo, Intro para abrir su ficha.`}
                  style={{ left: `${pos.x ?? 50}%`, top: `${pos.y ?? 50}%`, position: 'absolute', width: 168, transform: 'translate(-50%, -50%)', cursor: 'grab', touchAction: 'none', padding: '8px 10px' }}
                  className={`b2 ${moviendo ? 'dura' : 'dura-sm'} ${activo ? 'bg-azul' : 'bg-papel'}`}
                >
                  <span className="t-dato negra mayus" style={{ display: 'block', lineHeight: 1.15 }}>{av.nombre}</span>
                  {av.dolor_corto && <span className="t-micro" style={{ display: 'block', marginTop: 4, fontWeight: 500, lineHeight: 1.3 }}>{av.dolor_corto}</span>}
                </div>
              );
            })}

            {avatares.length === 0 && (
              <p className="t-dato" style={{ position: 'absolute', left: '50%', top: '56%', width: '100%', transform: 'translateX(-50%)', padding: '0 32px', textAlign: 'center', fontWeight: 500 }}>
                Escriba arriba un tipo de cliente y aparecera en el centro.
              </p>
            )}
          </div>
        </div>

        <div className="no-png">
          {!seleccionado ? (
            <div className="b2 bg-papel" style={{ padding: '24px 16px' }}>
              <p className="t-rotulo negra mayus" style={{ margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>Ninguna ficha abierta</p>
              <p className="t-dato" style={{ margin: '8px 0 0', fontWeight: 500 }}>
                Pulse un avatar del mapa para escribir su dolor, su sueno y que le hace decir NO o SI.
              </p>
            </div>
          ) : (
            <div className="b2 dura bg-papel">
              <div className="bg-tinta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '2px solid #000', padding: '10px 12px' }}>
                <h3 className="t-dato negra mayus" style={{ margin: 0, lineHeight: 1.15 }}>{seleccionado.nombre}</h3>
                <button onClick={() => setAbierto(null)} aria-label="Cerrar ficha" className="pulsable t-rotulo negra bg-tinta" style={{ border: 0, padding: '0 4px', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gap: 12, padding: 12 }}>
                <label style={{ display: 'block' }}>
                  <Etiqueta>Nombre</Etiqueta>
                  <Texto valor={seleccionado.nombre} onCambio={(s) => setAvatar(seleccionado.id, { nombre: s })} etiqueta="Nombre del avatar" />
                </label>
                <label style={{ display: 'block' }}>
                  <Etiqueta>Dolor en una frase (se ve en el mapa)</Etiqueta>
                  <Texto
                    valor={seleccionado.dolor_corto}
                    onCambio={(s) => setAvatar(seleccionado.id, { dolor_corto: s })}
                    etiqueta="Dolor en una frase"
                    placeholder="No le llegan presupuestos"
                  />
                </label>
                {CAMPOS.map((campo) => (
                  <label key={campo.clave} style={{ display: 'block' }}>
                    <Etiqueta>{campo.etiqueta}</Etiqueta>
                    <AreaTexto
                      valor={seleccionado[campo.clave]}
                      onCambio={(s) => setAvatar(seleccionado.id, { [campo.clave]: s })}
                      etiqueta={`${campo.etiqueta} de ${seleccionado.nombre}`}
                    />
                  </label>
                ))}
                <Boton onClick={() => { quitarAvatar(seleccionado.id); setAbierto(null); mapaRef.current?.focus(); }}>
                  Eliminar avatar
                </Boton>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
