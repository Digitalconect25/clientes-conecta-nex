// Scorecard · portado de ~/smart-offer-lab/src/paneles/Scorecard.tsx
// Puntua cada elemento de 1 a 5 en los cuatro criterios y los ordena. Los tres
// primeros del ranking son el nucleo de la oferta.
import { Membrete, Vacio } from './ui.jsx';
import { CRITERIOS, TOTAL_MAX, totalPuntos } from '../lib/nichos.js';

export function Scorecard({ items, setItem, cliente, fecha }) {
  if (items.length === 0) {
    return (
      <Vacio
        titulo="Nada que puntuar todavia"
        pista="Anada elementos en «Elementos y precios» y vuelva aqui para ordenarlos por peso."
      />
    );
  }

  const ranking = [...items].sort((a, b) => totalPuntos(b.puntos) - totalPuntos(a.puntos));

  return (
    <div>
      <Membrete cliente={cliente} titulo="Scorecard" fecha={fecha} />
      <div style={{ display: 'grid', alignItems: 'start', gap: 24, gridTemplateColumns: 'minmax(0, 1fr)' }} className="ol-cols">
        <div className="b2 bg-papel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-tinta">
                <th className="t-micro negra mayus track" style={{ padding: '10px 12px', textAlign: 'left' }}>Elemento</th>
                {CRITERIOS.map((c) => (
                  <th key={c.clave} style={{ borderLeft: '2px solid #fff', padding: '10px 12px', textAlign: 'left', verticalAlign: 'top' }}>
                    <span className="t-micro negra mayus" style={{ display: 'block', lineHeight: 1.15, letterSpacing: '0.06em' }}>{c.etiqueta}</span>
                    {/* La ayuda, escrita y visible: en un `title` no la lee nadie. */}
                    <span className="t-micro" style={{ display: 'block', marginTop: 4, maxWidth: 176, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>{c.ayuda}</span>
                  </th>
                ))}
                <th className="t-micro negra mayus track" style={{ borderLeft: '2px solid #fff', padding: '10px 12px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <FilaPuntos key={item.id} item={item} setItem={setItem} />
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="b2 bg-tinta t-micro negra mayus track" style={{ margin: 0, padding: '10px 12px' }}>
            Ranking · sobre {TOTAL_MAX}
          </h3>
          <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
            {ranking.map((item, i) => {
              const top = i < 3;
              return (
                <li
                  key={item.id}
                  className={`b2 ${top ? 'dura-sm bg-amarillo' : 'bg-papel'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}
                >
                  <span
                    className={`t-cuerpo negra ${top ? 'bg-tinta' : 'b2 bg-papel'}`}
                    style={{ display: 'flex', height: 32, width: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {i + 1}
                  </span>
                  <span className="t-dato negra mayus" style={{ flex: 1, lineHeight: 1.15 }}>{item.nombre}</span>
                  <span className={`negra cifras ${top ? 't-cifra' : 't-rotulo'}`}>{totalPuntos(item.puntos)}</span>
                </li>
              );
            })}
          </ol>
          <p className="t-dato" style={{ marginTop: 12, fontWeight: 500 }}>
            Los tres primeros son el nucleo de la oferta. El resto, relleno o trabajo para otro dia.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilaPuntos({ item, setItem }) {
  const total = totalPuntos(item.puntos);
  return (
    <tr style={{ borderTop: '2px solid #000' }}>
      <td className="t-dato negra mayus" style={{ padding: '8px 12px', verticalAlign: 'middle', lineHeight: 1.15 }}>{item.nombre}</td>
      {CRITERIOS.map((c) => (
        <td key={c.clave} style={{ borderLeft: '2px solid #000', padding: '8px 12px', verticalAlign: 'middle' }}>
          <Selector
            valor={item.puntos?.[c.clave] ?? 3}
            /* Sobre el valor mas reciente: puntuar los 4 criterios seguidos
               guardaba solo el ultimo y perdia los tres anteriores. */
            onCambio={(n) => setItem(item.id, (actual) => ({ puntos: { ...actual.puntos, [c.clave]: n } }))}
            etiqueta={`${item.nombre} · ${c.etiqueta}`}
          />
        </td>
      ))}
      <td className="bg-amarillo" style={{ borderLeft: '2px solid #000', padding: '0 12px', textAlign: 'center', verticalAlign: 'middle' }}>
        <span className="t-cifra negra cifras">{total}</span>
      </td>
    </tr>
  );
}

function Selector({ valor, onCambio, etiqueta }) {
  return (
    <div style={{ display: 'flex' }} role="group" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => {
        const activo = n === valor;
        return (
          <button
            key={n}
            onClick={() => onCambio(n)}
            aria-label={`${n} de 5`}
            aria-pressed={activo}
            className={`b2 pulsable t-cuerpo negra ${activo ? 'bg-azul' : 'bg-papel'}`}
            style={{ marginLeft: n === 1 ? 0 : -2, height: 40, width: 40 }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
