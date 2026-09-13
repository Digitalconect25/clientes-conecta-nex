// Ficha del cliente · portada de ~/smart-offer-lab/src/paneles/Ficha.tsx
//
// Sus datos y todo lo que hace falta saber para construirle el agente. El brief
// va DENTRO de esta pestana, igual que en la aplicacion original: son mas de
// treinta preguntas y plegadas por secciones se hacen; de golpe no las hace
// nadie.
import { useRef, useState } from 'react';
import { AreaTexto, Boton, BotonPng, Cifra, Etiqueta, Membrete, Texto, Titular, useDescargaPng } from './ui.jsx';
import { fechaLarga, money, pct, resumen } from '../lib/offerlab.js';
import { buscarNicho, CAMPOS_AGENTE, NICHOS, IMPRESCINDIBLES, totalPuntos } from '../lib/nichos.js';

const ESTADOS = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'enviada', etiqueta: 'Enviada' },
  { valor: 'aceptada', etiqueta: 'Aceptada' },
  { valor: 'rechazada', etiqueta: 'Rechazada' },
];

const CAMPOS_CLIENTE = [
  { clave: 'contacto', etiqueta: 'Persona de contacto', pista: 'Quien decide' },
  { clave: 'telefono', etiqueta: 'Telefono', tipo: 'tel' },
  { clave: 'email', etiqueta: 'Correo', tipo: 'email' },
  { clave: 'nif', etiqueta: 'NIF / CIF', pista: 'Para la factura' },
  { clave: 'localidad', etiqueta: 'Localidad' },
  { clave: 'origen', etiqueta: 'De donde viene', pista: 'Recomendacion, anuncio…' },
];

export function Ficha({ d, setD, setCampo, setFicha, items, cliente, fecha, onVaciar }) {
  const { ref, descargar, ocupado, error } = useDescargaPng(
    `ficha-${String(cliente).toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
  );
  const r = resumen(items);
  const top3 = [...items].sort((a, b) => totalPuntos(b.puntos) - totalPuntos(a.puntos)).slice(0, 3);

  return (
    <section>
      <Titular
        titulo="Ficha del cliente"
        apunte="Sus datos y todo lo que hace falta saber para construirle el agente."
        derecha={<BotonPng onClick={descargar} ocupado={ocupado} error={error} />}
      />

      <div ref={ref} className="bg-papel">
        <Membrete cliente={cliente} titulo="Ficha y brief" fecha={fecha} />

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Cifra rotulo="Valor de todo" valor={r.valorTotal} />
          <Cifra rotulo="Precio de la oferta" valor={r.precioOferta} tono="amarillo" grande />
          <Cifra
            rotulo={r.ahorro > 0 ? `Se ahorra un ${pct(r.ahorroPct)}` : r.ahorro < 0 ? 'OJO: cobra mas que el precio normal' : 'Sin descuento aplicado'}
            valor={r.ahorro}
            tono="azul"
          />
        </div>

        <div style={{ marginTop: 12, display: 'grid', alignItems: 'start', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <DatosCliente ficha={d.ficha_json} setFicha={setFicha} cliente={cliente} />
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="b2 bg-papel" style={{ padding: 16 }}>
              <Etiqueta>Nucleo de la oferta</Etiqueta>
              {top3.length === 0 ? (
                <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>Puntue los elementos en el Scorecard.</p>
              ) : (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                  {top3.map((item, i) => (
                    <li key={item.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="bg-tinta t-micro negra" style={{ display: 'flex', height: 24, width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <span className="t-dato negra mayus" style={{ flex: 1, lineHeight: 1.15 }}>{item.nombre}</span>
                      <span className="t-dato cifras" style={{ fontWeight: 700 }}>{money(item.precio)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="b2 bg-papel" style={{ padding: 16 }}>
              <Etiqueta>Creada</Etiqueta>
              <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>{fechaLarga(fecha)}</p>
            </div>
          </div>
        </div>

        <BriefAgente d={d} setD={setD} setCampo={setCampo} />
      </div>

      <CopiaDeSeguridad d={d} cliente={cliente} onVaciar={onVaciar} />
    </section>
  );
}

function DatosCliente({ ficha, setFicha, cliente }) {
  return (
    <div className="b2 bg-papel" style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Etiqueta>Cliente o empresa</Etiqueta>
          <p className="b2 bg-papel t-cuerpo negra" style={{ margin: 0, height: 44, display: 'flex', alignItems: 'center', padding: '0 8px' }}>{cliente}</p>
          <p className="t-micro" style={{ margin: '4px 0 0', fontWeight: 500 }}>Viene del prospecto: se cambia en Captacion en frio.</p>
        </div>

        {CAMPOS_CLIENTE.map((campo) => (
          <label key={campo.clave} style={{ display: 'block' }}>
            <Etiqueta>{campo.etiqueta}</Etiqueta>
            <Texto
              valor={ficha[campo.clave] || ''}
              onCambio={(s) => setFicha({ [campo.clave]: s })}
              etiqueta={campo.etiqueta}
              tipo={campo.tipo}
              placeholder={campo.pista}
            />
          </label>
        ))}

        <div>
          <label style={{ display: 'block' }}>
            <Etiqueta>Estado de la propuesta</Etiqueta>
            <select
              value={ficha.estado || 'borrador'}
              onChange={(e) => {
                const estado = e.currentTarget.value;
                // Al aceptarla queda registrado el dia, que es el dato que luego
                // hace falta para facturar y para medir cuanto se tarda en cerrar.
                setFicha({
                  estado,
                  aceptadaEl: estado === 'aceptada' ? (ficha.aceptadaEl || new Date().toISOString().slice(0, 10)) : '',
                });
              }}
              aria-label="Estado de la propuesta"
              className="t-cuerpo"
              style={{ height: 44, width: '100%', fontWeight: 700 }}
            >
              {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
          </label>
          {ficha.aceptadaEl && (
            <p className="t-dato negra" style={{ margin: '8px 0 0' }}>Aceptada el {fechaLarga(ficha.aceptadaEl)}</p>
          )}
        </div>

        <label style={{ display: 'block' }}>
          <Etiqueta>Valida hasta</Etiqueta>
          <Texto valor={ficha.validaHasta || ''} onCambio={(s) => setFicha({ validaHasta: s })} etiqueta="Valida hasta" tipo="date" />
        </label>
      </div>

      <label style={{ display: 'block' }}>
        <Etiqueta>Notas</Etiqueta>
        <AreaTexto
          valor={ficha.notas || ''} onCambio={(s) => setFicha({ notas: s })} etiqueta="Notas" filas={3}
          placeholder="Lo que le preocupa, lo que ya le han ofrecido otros, plazos…"
        />
      </label>
    </div>
  );
}

/**
 * El brief: lo que hay que sacarle al cliente para poder construir su agente.
 * Plegado por secciones porque son mas de treinta preguntas.
 */
function BriefAgente({ d, setD, setCampo }) {
  const [copiado, setCopiado] = useState(false);
  const [falloCopia, setFalloCopia] = useState(false);
  const nicho = buscarNicho(d.nicho);

  const comunes = CAMPOS_AGENTE.flatMap((s) => s.campos);
  const total = comunes.length + (nicho?.campos.length || 0);
  const hechos =
    comunes.filter((c) => (d.brief_comun[c.clave] || '').trim()).length +
    (nicho?.campos.filter((c) => (d.brief_nicho[c.clave] || '').trim()).length || 0);
  const faltanCriticos = comunes
    .filter((c) => IMPRESCINDIBLES.includes(c.clave) && !(d.brief_comun[c.clave] || '').trim())
    .map((c) => c.etiqueta);

  const textoBrief = () => {
    const l = [];
    if (nicho) l.push(`SECTOR: ${nicho.etiqueta}`, '');
    for (const s of CAMPOS_AGENTE) {
      const conValor = s.campos.filter((c) => (d.brief_comun[c.clave] || '').trim());
      if (!conValor.length) continue;
      l.push(s.titulo.toUpperCase());
      for (const c of conValor) l.push(`- ${c.etiqueta}: ${d.brief_comun[c.clave].trim()}`);
      l.push('');
    }
    if (nicho) {
      const conValor = nicho.campos.filter((c) => (d.brief_nicho[c.clave] || '').trim());
      if (conValor.length) {
        l.push(`PROPIO DE: ${nicho.etiqueta.toUpperCase()}`);
        for (const c of conValor) l.push(`- ${c.etiqueta}: ${d.brief_nicho[c.clave].trim()}`);
      }
    }
    return l.join('\n').trim();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoBrief());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setFalloCopia(true);
      setTimeout(() => setFalloCopia(false), 5000);
    }
  };

  return (
    <div className="b2 bg-papel" style={{ marginTop: 16 }}>
      <div className="bg-tinta" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '2px solid #000', padding: '12px 16px' }}>
        <h3 className="t-titulo negra mayus" style={{ margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>Brief del agente</h3>
        <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>
          <strong className="negra cifras">{hechos} de {total}</strong> preguntas respondidas
        </p>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <label style={{ display: 'block' }}>
            <Etiqueta>Sector del negocio</Etiqueta>
            <select
              value={d.nicho}
              onChange={(e) => setD((x) => ({ ...x, nicho: e.currentTarget.value }))}
              aria-label="Sector del negocio"
              className="t-cuerpo"
              style={{ height: 44, minWidth: 256, fontWeight: 700 }}
            >
              <option value="">Elija el sector…</option>
              {NICHOS.map((n) => <option key={n.id} value={n.id}>{n.etiqueta}</option>)}
            </select>
          </label>

          {/* Barra de avance: bloque macizo, sin degradados. */}
          <div style={{ minWidth: 192, flex: 1 }}>
            <Etiqueta>Avance del brief</Etiqueta>
            <div className="b2 bg-papel" style={{ height: 24 }}>
              <div className="bg-amarillo" style={{ height: '100%', width: `${total ? Math.round((hechos / total) * 100) : 0}%` }} />
            </div>
          </div>

          <div className="no-png" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <Boton tono={copiado ? 'amarillo' : 'papel'} onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar brief'}</Boton>
            {falloCopia && (
              <p role="alert" className="b2 bg-amarillo t-micro negra" style={{ maxWidth: 224, margin: 0, padding: '4px 8px' }}>
                Este navegador no deja copiar al portapapeles.
              </p>
            )}
          </div>
        </div>

        {faltanCriticos.length > 0 && (
          <div className="b2 bg-amarillo" style={{ marginTop: 16, padding: '8px 12px' }}>
            <p className="t-dato negra mayus" style={{ margin: 0, letterSpacing: '0.06em' }}>Sin esto no se puede empezar a construir</p>
            <p className="t-dato" style={{ margin: '4px 0 0', fontWeight: 500 }}>{faltanCriticos.join(' · ')}</p>
          </div>
        )}

        {!nicho && (
          <p className="t-dato" style={{ marginTop: 16, fontWeight: 500 }}>
            Elija el sector para que aparezcan las preguntas propias de ese negocio.
          </p>
        )}

        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          {CAMPOS_AGENTE.map((s) => (
            <Seccion key={s.id} titulo={s.titulo} porQue={s.porQue} campos={s.campos}
              valores={d.brief_comun} onCambio={(k, v) => setCampo('brief_comun', k, v)} />
          ))}
          {nicho && (
            <Seccion titulo={`Propio de: ${nicho.etiqueta}`} porQue="Lo que solo hace falta preguntar en este sector."
              campos={nicho.campos} valores={d.brief_nicho} onCambio={(k, v) => setCampo('brief_nicho', k, v)} destacada />
          )}
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, porQue, campos, valores, onCambio, destacada = false }) {
  const hechos = campos.filter((c) => (valores[c.clave] || '').trim()).length;
  return (
    <details className={`b2 ${destacada ? 'bg-amarillo' : 'bg-papel'}`}>
      <summary style={{ display: 'flex', cursor: 'pointer', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 16, rowGap: 4, padding: '10px 12px' }}>
        <span className="t-dato negra mayus track-sm">{titulo}</span>
        <span className="t-dato cifras" style={{ fontWeight: 700 }}>{hechos} / {campos.length}</span>
      </summary>
      <div className="bg-papel" style={{ borderTop: '2px solid #000', padding: 12 }}>
        <p className="t-dato" style={{ margin: '0 0 12px', fontWeight: 500 }}>{porQue}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {campos.map((c) => (
            <CampoBrief key={c.clave} campo={c} valor={valores[c.clave] || ''} onCambio={(v) => onCambio(c.clave, v)} />
          ))}
        </div>
      </div>
    </details>
  );
}

function CampoBrief({ campo, valor, onCambio }) {
  if (campo.tipo === 'opciones') {
    const marcadas = valor ? valor.split(' · ') : [];
    const alternar = (o) => {
      if (campo.unica) return onCambio(marcadas.includes(o) ? '' : o);
      onCambio((marcadas.includes(o) ? marcadas.filter((m) => m !== o) : [...marcadas, o]).join(' · '));
    };
    return (
      <div role="group" aria-label={campo.etiqueta}>
        <Etiqueta>{campo.etiqueta}</Etiqueta>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(campo.opciones || []).map((o) => {
            const activa = marcadas.includes(o);
            return (
              <button key={o} onClick={() => alternar(o)} aria-pressed={activa}
                className={`b2 pulsable t-dato negra ${activa ? 'bg-azul' : 'bg-papel'}`}
                style={{ minHeight: 36, padding: '0 12px' }}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label style={{ display: 'block' }}>
      <Etiqueta>{campo.etiqueta}</Etiqueta>
      {campo.tipo === 'area'
        ? <AreaTexto valor={valor} onCambio={onCambio} etiqueta={campo.etiqueta} placeholder={campo.pista} />
        : <Texto valor={valor} onCambio={onCambio} etiqueta={campo.etiqueta} placeholder={campo.pista} />}
    </label>
  );
}

function CopiaDeSeguridad({ d, cliente, onVaciar }) {
  const archivo = useRef(null);
  const [aviso, setAviso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const exportar = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offer-lab-${String(cliente).toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="no-png" style={{ marginTop: 24, borderTop: '2px solid #000', paddingTop: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <Etiqueta>Vaciar este diseno</Etiqueta>
        <p className="t-dato" style={{ margin: '0 0 12px', maxWidth: 640, fontWeight: 500 }}>
          Se lleva por delante los precios, el brief y los avatares de este prospecto. No se borra
          el prospecto ni sus propuestas. Descargue antes una copia.
        </p>
        {/* Sin confirm(): un dialogo del navegador corta el ritmo. Se confirma aqui. */}
        {confirmando ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Boton tono="amarillo" onClick={() => { onVaciar(); setConfirmando(false); }}>Si, vaciar</Boton>
            <Boton onClick={() => setConfirmando(false)}>Cancelar</Boton>
          </div>
        ) : (
          <Boton onClick={() => setConfirmando(true)}>Vaciar el diseno de «{cliente}»</Boton>
        )}
      </div>

      <Etiqueta>Copia de seguridad</Etiqueta>
      <p className="t-dato" style={{ margin: '0 0 12px', maxWidth: 640, fontWeight: 500 }}>
        Lo guardado vive en la base de datos de la agencia. Aun asi, un archivo suelto viene bien
        antes de un cambio gordo, o para llevarselo a otro sitio.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Boton onClick={exportar}>↓ Guardar copia</Boton>
        <Boton onClick={() => archivo.current?.click()}>↑ Cargar copia</Boton>
        {aviso && <p role="status" className="b2 bg-amarillo t-dato negra" style={{ margin: 0, padding: '8px 12px' }}>{aviso}</p>}
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!f) return;
            const res = await (window.__offerlabImportar?.(await f.text()) ?? Promise.resolve({ mensaje: 'No se pudo cargar.' }));
            setAviso(res.mensaje);
            setTimeout(() => setAviso(null), 6000);
          }}
        />
      </div>
    </div>
  );
}
