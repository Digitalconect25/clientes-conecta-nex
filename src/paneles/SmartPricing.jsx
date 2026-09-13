// Smart Pricing · portado de ~/smart-offer-lab/src/paneles/SmartPricing.tsx
// Precio normal, precio de oferta, el suelo que marca su descuento maximo y el
// pago a plazos. Con la sub-pestana del Scorecard al lado.
import { useRef, useState } from 'react';
import { Anadir, Boton, BotonPng, Cifra, Etiqueta, Membrete, Numero, Texto, Titular, useDescargaPng, Vacio } from './ui.jsx';
import { Scorecard } from './Scorecard.jsx';
import { descuentoReal, money, pct, precioSuelo, resumen, totalPlazos } from '../lib/offerlab.js';

export function SmartPricing({ items, addItem, setItem, quitarItem, cliente, fecha }) {
  const [sub, setSub] = useState('elementos');
  const { ref, descargar, ocupado, error } = useDescargaPng(sub === 'elementos' ? 'smart-pricing' : 'scorecard');

  return (
    <section>
      <Titular
        titulo="Smart Pricing"
        apunte={sub === 'elementos'
          ? 'Precio normal, precio de oferta, su suelo y el pago a plazos.'
          : 'Puntue de 1 a 5. El total decide que entra en la oferta.'}
        derecha={<BotonPng onClick={descargar} ocupado={ocupado} error={error} />}
      />

      <div className="no-png" style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex' }}>
          {['elementos', 'scorecard'].map((id, n) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              aria-current={sub === id ? 'true' : undefined}
              className={`b2 pulsable t-dato negra mayus track-sm ${sub === id ? 'bg-amarillo' : 'bg-papel'}`}
              style={{ marginLeft: n === 0 ? 0 : -2, minHeight: 44, padding: '0 16px' }}
            >
              {id === 'elementos' ? 'Elementos y precios' : 'Scorecard'}
            </button>
          ))}
        </div>
        {sub === 'elementos' && <Anadir placeholder="Nombre del elemento…" textoBoton="+ Anadir" onAnadir={addItem} />}
      </div>

      <div ref={ref} className="bg-papel">
        {sub === 'elementos'
          ? <ListaElementos items={items} setItem={setItem} quitarItem={quitarItem} cliente={cliente} fecha={fecha} />
          : <Scorecard items={items} setItem={setItem} cliente={cliente} fecha={fecha} />}
      </div>
    </section>
  );
}

function ListaElementos({ items, setItem, quitarItem, cliente, fecha }) {
  /** Sitio al que devolver el foco cuando se borra una ficha. */
  const lista = useRef(null);
  const r = resumen(items);

  if (items.length === 0) {
    return (
      <Vacio
        titulo="Su oferta esta vacia"
        pista="Escriba arriba el primer elemento: una web, una auditoria, una sesion. Despues le pone precio."
      />
    );
  }

  return (
    <>
      <Membrete cliente={cliente} titulo="Precios" fecha={fecha} />

      {/* El total de la oferta: sin esto hay que sumar de cabeza delante del cliente. */}
      <div style={{ marginBottom: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Cifra rotulo="Valor de todo" valor={r.valorTotal} />
        <Cifra rotulo="Precio de la oferta" valor={r.precioOferta} tono="amarillo" grande />
        <Cifra
          rotulo={r.ahorro > 0 ? `Se ahorra un ${pct(r.ahorroPct)}` : r.ahorro < 0 ? 'OJO: cobra mas que el precio normal' : 'Sin descuento aplicado'}
          valor={r.ahorro}
          tono="azul"
        />
      </div>

      <div ref={lista} tabIndex={-1} style={{ display: 'grid', gap: 12, outline: 'none' }}>
        {items.map((item) => (
          <Fila key={item.id} item={item} setItem={setItem} quitarItem={quitarItem} alBorrar={() => lista.current?.focus()} />
        ))}
      </div>
    </>
  );
}

function Fila({ item, setItem, quitarItem, alBorrar }) {
  const [abierto, setAbierto] = useState(false);

  const plazos = totalPlazos(item.plazos);
  const real = descuentoReal(item);
  const suelo = precioSuelo(item);
  const hayDescuento = Number(item.precio_oferta) > 0;
  /* Sin `hayDescuento`, un elemento recien creado (descuento a 0 = «sin
     descuento») daba un 100 % y saltaba la alarma nada mas poner el precio. */
  const pasado = hayDescuento && Number(item.precio) > 0 && real > Number(item.descuento_max) + 0.01;

  return (
    /* Elevado = abierto. La sombra marca en que esta trabajando, no adorna. */
    <article className={`b2 bg-papel ${abierto ? 'dura' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="bg-papel"
          style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 24, rowGap: 8, padding: '12px 16px', textAlign: 'left', border: 0 }}
        >
          <span className="t-rotulo negra mayus" style={{ lineHeight: 1.15, letterSpacing: '-0.02em' }}>{item.nombre}</span>

          {/* Las cifras caen en la misma vertical fila tras fila y se comparan
              de un vistazo. */}
          <span style={{ display: 'flex', minWidth: 0, alignItems: 'baseline', gap: 12 }}>
            <span className="t-dato cifras" style={{ fontWeight: 700, textDecoration: 'line-through', textAlign: 'right' }}>
              {Number(item.precio_oferta) > 0 && Number(item.precio) > Number(item.precio_oferta) ? money(item.precio) : ''}
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className="bg-amarillo t-cifra negra cifras" style={{ padding: '2px 8px', lineHeight: 1 }}>
                {money(Number(item.precio_oferta) > 0 ? item.precio_oferta : item.precio)}
              </span>
            </span>
            <span className="t-dato cifras text-azul" style={{ fontWeight: 700, textAlign: 'right' }}>
              {plazos > 0 ? `o ${item.plazos.numero} × ${money(item.plazos.monto)}` : ''}
            </span>
          </span>
        </button>

        <button
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? `Plegar ${item.nombre}` : `Desplegar ${item.nombre}`}
          className="no-png b2 pulsable bg-papel t-rotulo negra"
          style={{ borderTop: 0, borderBottom: 0, borderRight: 0, padding: '0 16px' }}
        >
          {abierto ? '−' : '+'}
        </button>
        <button
          onClick={() => { quitarItem(item.id); alBorrar(); }}
          aria-label={`Eliminar ${item.nombre}`}
          className="no-png b2 pulsable bg-papel t-rotulo negra"
          style={{ borderTop: 0, borderBottom: 0, borderRight: 0, padding: '0 16px' }}
        >
          ×
        </button>
      </div>

      {abierto && (
        /* Todo el detalle es de taller: aqui estan su descuento maximo, su suelo
           de precio y el aviso de que se ha pasado. Eso es su margen, no algo
           que el cliente deba ver en la reunion ni encontrar en el PNG. */
        <div className="no-png" style={{ borderTop: '2px solid #000', padding: 16 }}>
          <label className="no-png" style={{ display: 'block', marginBottom: 16, maxWidth: 448 }}>
            <Etiqueta>Nombre</Etiqueta>
            <Texto valor={item.nombre} onCambio={(s) => setItem(item.id, { nombre: s })} etiqueta="Nombre del elemento" />
          </label>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'block' }}>
              <Etiqueta>Precio normal</Etiqueta>
              <Numero valor={Number(item.precio) || 0} onCambio={(n) => setItem(item.id, { precio: n })} unidad="€" etiqueta={`Precio normal de ${item.nombre}, en euros`} />
            </label>
            <label style={{ display: 'block' }}>
              <Etiqueta>Precio con descuento</Etiqueta>
              <Numero valor={Number(item.precio_oferta) || 0} onCambio={(n) => setItem(item.id, { precio_oferta: n })} unidad="€" etiqueta={`Precio con descuento de ${item.nombre}, en euros`} />
            </label>
            <label style={{ display: 'block' }}>
              <Etiqueta>Descuento maximo</Etiqueta>
              <Numero valor={Number(item.descuento_max) || 0} onCambio={(n) => setItem(item.id, { descuento_max: n })} unidad="%" max={100} etiqueta={`Descuento maximo de ${item.nombre}, en porcentaje`} />
            </label>
          </div>

          <p className="t-dato" style={{ marginTop: 12, fontWeight: 500 }}>
            {hayDescuento ? (
              <>Esta aplicando un <strong className="negra cifras">{pct(real)}</strong>. Con su tope del {item.descuento_max} % no deberia bajar de <strong className="negra cifras">{money(suelo)}</strong>.</>
            ) : (
              <>Sin descuento: se vende a precio normal. Con su tope del {item.descuento_max} % podria bajar hasta <strong className="negra cifras">{money(suelo)}</strong>.</>
            )}
          </p>

          {pasado && (
            <p role="alert" className="b2 bg-amarillo t-cuerpo negra" style={{ marginTop: 12, padding: '8px 12px' }}>
              Se ha pasado de su descuento maximo. El suelo es {money(suelo)}.
            </p>
          )}

          <div className="b2" style={{ marginTop: 20 }}>
            <p className="bg-tinta t-micro negra mayus" style={{ margin: 0, borderBottom: '2px solid #000', padding: '8px 12px', letterSpacing: '0.12em' }}>
              Pago a plazos
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 16, rowGap: 12, padding: 12 }}>
              <label style={{ display: 'block', width: 96 }}>
                <Etiqueta>N.º de pagos</Etiqueta>
                <Numero
                  valor={Number(item.plazos?.numero) || 0}
                  onCambio={(n) => setItem(item.id, (a) => ({ plazos: { ...a.plazos, numero: Math.round(n) } }))}
                  max={120}
                  etiqueta={`Numero de pagos de ${item.nombre}`}
                />
              </label>
              <span aria-hidden className="t-rotulo negra" style={{ paddingBottom: 12 }}>×</span>
              <label style={{ display: 'block', width: 160 }}>
                <Etiqueta>Importe de cada pago</Etiqueta>
                <Numero
                  valor={Number(item.plazos?.monto) || 0}
                  onCambio={(n) => setItem(item.id, (a) => ({ plazos: { ...a.plazos, monto: n } }))}
                  unidad="€"
                  etiqueta={`Importe de cada pago de ${item.nombre}, en euros`}
                />
              </label>
              <span aria-hidden className="t-rotulo negra" style={{ paddingBottom: 12 }}>=</span>
              <div className="b2 bg-amarillo" style={{ padding: '6px 12px' }}>
                <Etiqueta>Total a plazos</Etiqueta>
                <p className="t-cifra negra cifras" style={{ margin: 0, lineHeight: 1 }}>{money(plazos)}</p>
              </div>
              {Number(item.precio_oferta) > 0 && plazos > 0 && (
                <p className="t-dato" style={{ maxWidth: 256, paddingBottom: 4, fontWeight: 500 }}>
                  {plazos > Number(item.precio_oferta)
                    ? `Son ${money(plazos - Number(item.precio_oferta))} mas que pagando de una vez.`
                    : plazos < Number(item.precio_oferta)
                      ? `Son ${money(Number(item.precio_oferta) - plazos)} menos que pagando de una vez.`
                      : 'Cuesta lo mismo que pagando de una vez.'}
                </p>
              )}
            </div>
          </div>

          <div className="no-png" style={{ marginTop: 16 }}>
            <Boton onClick={() => setAbierto(false)}>Cerrar ficha</Boton>
          </div>
        </div>
      )}
    </article>
  );
}
