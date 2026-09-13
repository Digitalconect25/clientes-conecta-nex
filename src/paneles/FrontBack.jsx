// Front / Back Offer · portado de ~/smart-offer-lab/src/paneles/FrontBack.tsx
// Se arrastra cada servicio a su columna. Quien no use raton tiene el boton
// «Mover», que va rotando entre sin asignar → front → back.
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Anadir, BotonPng, Membrete, Titular, useDescargaPng } from './ui.jsx';
import { money } from '../lib/offerlab.js';

const COLUMNAS = [
  { id: 'front', titulo: 'Front Offer', pie: 'Puerta de entrada · baja friccion' },
  { id: 'back', titulo: 'Back Offer', pie: 'Ticket alto · monetizacion profunda' },
];

/** Orden del ciclo al pulsar «Mover»: la via por teclado, sin arrastrar. */
const CICLO = ['sin-asignar', 'front', 'back'];
const NOMBRES = { 'sin-asignar': 'sin asignar', front: 'Front Offer', back: 'Back Offer' };

export function FrontBack({ items, addItem, setItem, cliente, fecha }) {
  const { ref, descargar, ocupado, error } = useDescargaPng('front-back-offer');
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Sin esto, quien no use raton no puede repartir los servicios.
    useSensor(KeyboardSensor),
  );

  function alSoltar(e) {
    const destino = e.over?.id;
    if (!destino) return;
    setItem(String(e.active.id), { columna: destino });
  }

  const sinAsignar = items.filter((i) => (i.columna || 'sin-asignar') === 'sin-asignar');

  return (
    <section>
      <Titular
        titulo="Front / Back Offer"
        apunte="Arrastre cada servicio a su columna, o use «Mover». Los precios se editan en Precios."
        derecha={<BotonPng onClick={descargar} ocupado={ocupado} error={error} />}
      />

      <div className="no-png" style={{ marginBottom: 24 }}>
        <Anadir placeholder="Nombre del servicio…" textoBoton="+ Anadir" onAnadir={addItem} />
      </div>

      <DndContext sensors={sensores} onDragEnd={alSoltar}>
        <div ref={ref} className="bg-papel">
          <Membrete cliente={cliente} titulo="Front / Back Offer" fecha={fecha} />

          <Zona id="sin-asignar">
            <p className="t-micro negra mayus track" style={{ margin: '0 0 12px' }}>Sin asignar · {sinAsignar.length}</p>
            {sinAsignar.length === 0 ? (
              <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>Todo repartido. Puede arrastrar de vuelta cualquier servicio.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sinAsignar.map((item) => <Tarjeta key={item.id} item={item} setItem={setItem} />)}
              </div>
            )}
          </Zona>

          <div style={{ marginTop: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {COLUMNAS.map((col) => <ColumnaOferta key={col.id} col={col} items={items} setItem={setItem} />)}
          </div>
        </div>
      </DndContext>
    </section>
  );
}

function ColumnaOferta({ col, items, setItem }) {
  const propios = items.filter((i) => i.columna === col.id);
  const suma = propios.reduce((t, i) => t + (Number(i.precio) || 0), 0);
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`b2 ${isOver ? 'dura bg-amarillo' : 'bg-papel'}`}
      style={{ display: 'flex', minHeight: 272, flexDirection: 'column', transition: 'background-color 100ms' }}
    >
      <div className="bg-tinta" style={{ borderBottom: '2px solid #000', padding: '12px 16px' }}>
        <h3 className="t-titulo negra mayus" style={{ margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{col.titulo}</h3>
        <p className="t-dato" style={{ margin: '6px 0 0', fontWeight: 500 }}>{col.pie}</p>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 8, padding: 12 }}>
        {propios.length === 0
          ? <p className="t-dato" style={{ margin: 'auto', textAlign: 'center', fontWeight: 500 }}>Suelte aqui los servicios</p>
          : propios.map((item) => <Tarjeta key={item.id} item={item} setItem={setItem} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '2px solid #000', padding: '10px 16px' }}>
        <span className="t-micro negra mayus track">{propios.length} {propios.length === 1 ? 'servicio' : 'servicios'}</span>
        <span className="t-cifra negra cifras" style={{ lineHeight: 1 }}>{money(suma)}</span>
      </div>
    </div>
  );
}

function Zona({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`b2 ${isOver ? 'bg-amarillo' : 'bg-papel'}`} style={{ minHeight: 96, padding: 16, transition: 'background-color 100ms' }}>
      {children}
    </div>
  );
}

function Tarjeta({ item, setItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });

  const estilo = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 }
    : undefined;

  const siguiente = CICLO[(CICLO.indexOf(item.columna || 'sin-asignar') + 1) % CICLO.length];

  return (
    <div
      ref={setNodeRef}
      style={{ display: 'flex', alignItems: 'stretch', touchAction: 'none', ...estilo }}
      className={`b2 ${isDragging ? 'dura' : 'dura-sm'} ${item.best_seller ? 'bg-amarillo' : 'bg-papel'}`}
    >
      <button
        {...listeners}
        {...attributes}
        aria-roledescription="Servicio arrastrable"
        style={{ flex: 1, cursor: 'grab', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 0, color: 'inherit' }}
      >
        <span className="t-dato negra mayus" style={{ display: 'block', lineHeight: 1.15 }}>{item.nombre}</span>
        <span className="t-rotulo negra cifras" style={{ display: 'block', marginTop: 2, lineHeight: 1 }}>{money(item.precio)}</span>
      </button>
      <button
        onClick={() => setItem(item.id, { columna: siguiente })}
        aria-label={`Mover ${item.nombre} a ${NOMBRES[siguiente]}`}
        title={`Mover a ${NOMBRES[siguiente]}`}
        className="no-png b2 pulsable t-dato negra bg-papel"
        style={{ borderTop: 0, borderBottom: 0, borderRight: 0, padding: '0 8px' }}
      >
        →
      </button>
      <button
        onClick={() => setItem(item.id, (a) => ({ best_seller: !a.best_seller }))}
        aria-label={`${item.best_seller ? 'Quitar' : 'Marcar'} best seller: ${item.nombre}`}
        aria-pressed={!!item.best_seller}
        title="Best seller"
        className={`b2 pulsable t-rotulo ${item.best_seller ? 'bg-tinta' : 'bg-papel'}`}
        style={{ borderTop: 0, borderBottom: 0, borderRight: 0, padding: '0 10px', lineHeight: 1, color: item.best_seller ? '#ffd400' : '#000' }}
      >
        {item.best_seller ? '★' : '☆'}
      </button>
    </div>
  );
}
