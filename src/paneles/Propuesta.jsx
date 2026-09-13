// Propuesta · portada de ~/smart-offer-lab/src/paneles/Propuesta.tsx
//
// El documento que ve el cliente, montado solo con lo que hay en las otras
// pestanas. El PDF lo genera el propio navegador con «Guardar como PDF»: sale
// texto real y seleccionable, pesa poco y no hace falta ninguna libreria.
//
// Los datos del emisor NO se piden aqui: se leen de «Mis datos» del CRM, que es
// donde ya estaban y de donde salen los contratos. Asi no hay dos sitios donde
// tener el mismo NIF.
import { useEffect, useState } from 'react';
import { AreaTexto, Boton, Etiqueta, Texto, Titular, Vacio } from './ui.jsx';
import { fechaLarga, money, pct, precioVenta, resumen, totalPlazos } from '../lib/offerlab.js';

export function Propuesta({ items, ficha, setFicha, emisor, cliente, fecha }) {
  const [qr, setQr] = useState(null);
  const r = resumen(items);
  const conPlazos = items.filter((i) => totalPlazos(i.plazos) > 0);
  const enlace = String(ficha.enlacePago || '').trim();

  /* El QR se dibuja aqui, en el navegador: en papel un enlace no se puede pulsar. */
  useEffect(() => {
    if (!enlace) { setQr(null); return; }
    let vivo = true;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(enlace, { margin: 1, width: 280, color: { dark: '#000000', light: '#ffffff' } });
        if (vivo) setQr(url);
      } catch { if (vivo) setQr(null); }
    })();
    return () => { vivo = false; };
  }, [enlace]);

  const datosEmisor = emisor || {};
  const nombreEmisor = datosEmisor.nombre_comercial || datosEmisor.nombre || '';

  return (
    <section>
      {/* El titulo de la pestana no va al papel: el documento ya lleva el suyo. */}
      <div className="no-imprimir">
        <Titular
          titulo="Propuesta"
          apunte="Asi la va a ver el cliente. El PDF lo genera el propio navegador."
          derecha={
            <div className="no-imprimir no-png" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Boton tono="azul" onClick={() => window.print()}>↓ Guardar en PDF</Boton>
              <p className="t-micro" style={{ margin: 0, fontWeight: 500 }}>En destino, elija «Guardar como PDF»</p>
            </div>
          }
        />
      </div>

      {/* Ajustes que no salen impresos */}
      <div className="no-imprimir no-png" style={{ marginBottom: 24, display: 'grid', gap: 8 }}>
        <details className="b2 bg-papel">
          <summary className="t-dato negra mayus track-sm" style={{ cursor: 'pointer', padding: '10px 12px' }}>
            Sus datos {nombreEmisor ? '· de «Mis datos»' : '· SIN RELLENAR'}
          </summary>
          <div style={{ borderTop: '2px solid #000', padding: 12 }}>
            {nombreEmisor ? (
              <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>
                Salen de «Mis datos» del CRM: <b>{nombreEmisor}</b>
                {datosEmisor.nif ? ` · ${datosEmisor.nif}` : ''}. Se cambian alli y valen para todo.
              </p>
            ) : (
              <p className="b2 bg-amarillo t-dato negra" style={{ margin: 0, padding: '6px 10px' }}>
                Rellene «Mis datos» en el menu: la propuesta sale sin remitente.
              </p>
            )}
          </div>
        </details>

        <details className="b2 bg-papel">
          <summary className="t-dato negra mayus track-sm" style={{ cursor: 'pointer', padding: '10px 12px' }}>
            Condiciones y siguiente paso
          </summary>
          <div style={{ display: 'grid', gap: 12, borderTop: '2px solid #000', padding: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <label style={{ display: 'block' }}>
              <Etiqueta>Condiciones</Etiqueta>
              <AreaTexto
                valor={ficha.condiciones} onCambio={(s) => setFicha({ condiciones: s })} filas={4}
                etiqueta="Condiciones" placeholder="Forma de pago, plazos de entrega, que no incluye, IVA aparte…"
              />
            </label>
            <label style={{ display: 'block' }}>
              <Etiqueta>Que pasa cuando diga que si</Etiqueta>
              <AreaTexto
                valor={ficha.siguientePaso} onCambio={(s) => setFicha({ siguientePaso: s })} filas={4}
                etiqueta="Siguiente paso" placeholder="Firma, 50 % por adelantado y arrancamos en 5 dias con una reunion de una hora."
              />
            </label>
          </div>
        </details>

        <details className="b2 bg-papel">
          <summary className="t-dato negra mayus track-sm" style={{ cursor: 'pointer', padding: '10px 12px' }}>
            Cobrar desde la propuesta {enlace ? '' : '· sin enlace'}
          </summary>
          <div style={{ display: 'grid', gap: 12, borderTop: '2px solid #000', padding: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <label style={{ display: 'block' }}>
              <Etiqueta>Enlace de cobro</Etiqueta>
              <Texto valor={ficha.enlacePago} onCambio={(s) => setFicha({ enlacePago: s })} etiqueta="Enlace de cobro" placeholder="https://buy.stripe.com/…" />
            </label>
            <label style={{ display: 'block' }}>
              <Etiqueta>Que se paga ahi</Etiqueta>
              <Texto valor={ficha.conceptoPago} onCambio={(s) => setFicha({ conceptoPago: s })} etiqueta="Concepto del pago" placeholder="Senal del 50 % para reservar la fecha de arranque" />
            </label>
            <p className="t-dato" style={{ gridColumn: '1 / -1', margin: 0, fontWeight: 500 }}>
              Pegue un enlace que ya tenga creado (Stripe, Bizum, su banco). Aqui solo se imprime
              con su codigo QR, para que se pueda pagar desde el papel.
            </p>
          </div>
        </details>
      </div>

      {items.length === 0 ? (
        <Vacio
          titulo="No hay nada que proponer todavia"
          pista="Anada elementos en Precios y vuelva aqui: la propuesta se monta sola."
        />
      ) : (
        <article className="documento b2 bg-papel" style={{ margin: '0 auto', maxWidth: '210mm', padding: 32 }}>
          {/* Membrete */}
          <header className="junto" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
            <div>
              {nombreEmisor ? (
                <>
                  <p className="t-rotulo negra mayus" style={{ margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{nombreEmisor}</p>
                  <p className="t-dato" style={{ margin: '4px 0 0', fontWeight: 500 }}>
                    {[datosEmisor.nif, [datosEmisor.direccion, datosEmisor.cp, datosEmisor.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>
                    {[datosEmisor.telefono, datosEmisor.email, datosEmisor.web].filter(Boolean).join(' · ')}
                  </p>
                </>
              ) : (
                <p className="b2 bg-amarillo t-dato negra" style={{ margin: 0, padding: '4px 8px' }}>
                  Rellene «Mis datos»: la propuesta sale sin remitente.
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="t-titulo negra mayus" style={{ margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>Propuesta</p>
              <p className="t-dato" style={{ margin: '4px 0 0', fontWeight: 500 }}>{fechaLarga(fecha)}</p>
              {ficha.validaHasta && <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>Valida hasta {fechaLarga(ficha.validaHasta)}</p>}
            </div>
          </header>

          {/* Para quien */}
          <div className="junto" style={{ marginTop: 20 }}>
            <Etiqueta>Para</Etiqueta>
            <p className="t-rotulo negra mayus" style={{ margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{cliente}</p>
            <p className="t-dato" style={{ margin: '4px 0 0', fontWeight: 500 }}>
              {[ficha.contacto, ficha.nif, ficha.localidad, ficha.telefono, ficha.email].filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* El detalle */}
          <table style={{ marginTop: 24, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-tinta">
                <th className="t-micro negra mayus track" style={{ padding: '8px 12px', textAlign: 'left' }}>Concepto</th>
                <th className="t-micro negra mayus track" style={{ width: 112, borderLeft: '2px solid #fff', padding: '8px 12px', textAlign: 'right' }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const venta = precioVenta(item);
                const rebajado = Number(item.precio_oferta) > 0 && Number(item.precio) > Number(item.precio_oferta);
                return (
                  <tr key={item.id} style={{ borderTop: '2px solid #000' }}>
                    <td className="t-cuerpo negra mayus" style={{ padding: '10px 12px', lineHeight: 1.15 }}>{item.nombre}</td>
                    <td style={{ borderLeft: '2px solid #000', padding: '10px 12px', textAlign: 'right' }}>
                      {rebajado && <span className="t-dato cifras" style={{ marginRight: 8, fontWeight: 700, textDecoration: 'line-through' }}>{money(item.precio)}</span>}
                      <span className="t-cuerpo negra cifras">{money(venta)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {r.ahorro > 0 && (
                <tr style={{ borderTop: '2px solid #000' }}>
                  <td className="t-dato" style={{ padding: '8px 12px', fontWeight: 500 }}>
                    Valor de todo por separado: {money(r.valorTotal)}. Su descuento:
                  </td>
                  <td className="t-cuerpo negra cifras" style={{ borderLeft: '2px solid #000', padding: '8px 12px', textAlign: 'right' }}>−{money(r.ahorro)}</td>
                </tr>
              )}
              <tr className="bg-amarillo" style={{ borderTop: '2px solid #000' }}>
                <td className="t-cuerpo negra mayus track-sm" style={{ padding: '12px' }}>
                  Total{r.ahorro > 0 ? ` (ahorra un ${pct(r.ahorroPct)})` : ''}
                </td>
                <td className="t-cifra negra cifras" style={{ borderLeft: '2px solid #000', padding: '12px', textAlign: 'right', lineHeight: 1 }}>{money(r.precioOferta)}</td>
              </tr>
            </tfoot>
          </table>

          {conPlazos.length > 0 && (
            <div className="junto" style={{ marginTop: 24 }}>
              <Etiqueta>Tambien se puede pagar a plazos</Etiqueta>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                {conPlazos.map((item) => (
                  <li key={item.id} className="t-cuerpo" style={{ fontWeight: 500 }}>
                    <strong className="negra">{item.nombre}</strong>: {item.plazos.numero} pagos de{' '}
                    <strong className="negra cifras">{money(item.plazos.monto)}</strong>{' '}
                    <span className="t-dato">(total {money(totalPlazos(item.plazos))})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ficha.condiciones && (
            <div className="junto" style={{ marginTop: 24 }}>
              <Etiqueta>Condiciones</Etiqueta>
              <p className="t-cuerpo" style={{ margin: 0, whiteSpace: 'pre-wrap', fontWeight: 500 }}>{ficha.condiciones}</p>
            </div>
          )}

          {/* Cobro: el QR sirve en papel, el enlace sirve en el PDF */}
          {enlace && (
            <div className="junto b2" style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, padding: 16 }}>
              {qr && <img src={qr} alt={`Codigo QR para pagar: ${enlace}`} style={{ height: 112, width: 112, flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <Etiqueta>{ficha.conceptoPago || 'Puede dejarlo cerrado ahora mismo'}</Etiqueta>
                <p className="t-cuerpo" style={{ margin: 0, fontWeight: 500 }}>Apunte con la camara al codigo o entre en:</p>
                <a href={enlace} className="t-cuerpo negra text-azul" style={{ wordBreak: 'break-all', textDecoration: 'underline' }}>{enlace}</a>
              </div>
            </div>
          )}

          {ficha.siguientePaso && (
            <div className="junto b2 bg-amarillo" style={{ marginTop: 24, padding: 16 }}>
              <Etiqueta>Si le encaja, esto es lo que pasa</Etiqueta>
              <p className="t-cuerpo" style={{ margin: 0, whiteSpace: 'pre-wrap', fontWeight: 500 }}>{ficha.siguientePaso}</p>
            </div>
          )}

          {/* Conformidad */}
          <div className="junto b2" style={{ marginTop: 32, padding: 16 }}>
            {ficha.aceptadaEl ? (
              <p className="t-cuerpo negra" style={{ margin: 0 }}>Propuesta aceptada el {fechaLarga(ficha.aceptadaEl)}.</p>
            ) : (
              <>
                <p className="t-cuerpo negra mayus track-sm" style={{ margin: 0 }}>☐ Acepto esta propuesta</p>
                <p className="t-dato" style={{ margin: '4px 0 0', fontWeight: 500 }}>
                  Devuelvala firmada por correo, o digamelo por escrito: con eso basta para reservar la fecha.
                </p>
              </>
            )}

            <div style={{ marginTop: 24, display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 32 }} />
                <p className="t-micro negra mayus track" style={{ margin: '4px 0 0' }}>Por {nombreEmisor || 'la empresa'}</p>
              </div>
              <div>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 32 }} />
                <p className="t-micro negra mayus track" style={{ margin: '4px 0 0' }}>Nombre, DNI y fecha · {cliente}</p>
              </div>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
