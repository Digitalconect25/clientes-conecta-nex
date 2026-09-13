// Offer Lab dentro del CRM, para UN prospecto.
//
// Es la herramienta de ~/smart-offer-lab portada tal cual: misma estetica
// (cuatro colores, bordes de 2px, sombras duras, tipografia negra), mismos
// paneles y mismas exportaciones a PNG. Lo unico que cambia es donde se
// guarda: alli era el navegador, aqui es Neon (tabla diseno_oferta), para que
// el trabajo no se quede en un solo ordenador y pueda alimentar la propuesta.
//
// Pestanas:
//   1. Brief del agente  -> lo que hay que sacarle al cliente para construirlo
//   2. Precios           -> Smart Pricing + Scorecard (sub-pestana)
//   3. Front / Back      -> puerta de entrada vs ticket alto
//   4. Avatares          -> a quien va dirigido, por anillo de afinidad
//
// No es una isla: el brief entra en el prompt de la propuesta con IA
// (api/propuestas.js) y los elementos se vuelcan como lineas de propuesta.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CAMPOS_AGENTE, NICHOS, buscarNicho, IMPRESCINDIBLES } from '../lib/nichos.js';
import { money, nuevoAvatar, nuevoItem, resumen } from '../lib/offerlab.js';
import { SmartPricing } from '../paneles/SmartPricing.jsx';
import { FrontBack } from '../paneles/FrontBack.jsx';
import { Avatares } from '../paneles/Avatares.jsx';
import { AreaTexto, Boton, Texto, Titular } from '../paneles/ui.jsx';
import '../styles/offerlab.css';

const PESTANAS = [
  { id: 'brief', texto: 'Brief' },
  { id: 'pricing', texto: 'Precios' },
  { id: 'oferta', texto: 'Front / Back' },
  { id: 'avatares', texto: 'Avatares' },
];

export default function Diseno() {
  const { prospectoId } = useParams();
  const navigate = useNavigate();
  const [prospecto, setProspecto] = useState(null);
  const [d, setD] = useState({ nicho: '', brief_comun: {}, brief_nicho: {}, items_json: [], avatares_json: [] });
  const [pestana, setPestana] = useState('brief');
  const [presentacion, setPresentacion] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [prospectoId]);

  async function cargar() {
    setCargando(true); setError('');
    try {
      const [p, dis] = await Promise.all([
        api.prospectoGet(prospectoId).catch(() => null),
        api.disenoGet(prospectoId),
      ]);
      setProspecto(p?.prospecto || p || null);
      setD({
        nicho: dis.nicho || '',
        brief_comun: dis.brief_comun || {},
        brief_nicho: dis.brief_nicho || {},
        items_json: Array.isArray(dis.items_json) ? dis.items_json : [],
        avatares_json: Array.isArray(dis.avatares_json) ? dis.avatares_json : [],
      });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el diseno.');
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    setGuardando(true); setError(''); setAviso('');
    try {
      await api.disenoGuardar({ prospecto_id: Number(prospectoId), ...d });
      setAviso('Guardado.');
      setTimeout(() => setAviso(''), 2500);
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function crearPropuesta() {
    setGuardando(true); setError('');
    try {
      await api.disenoGuardar({ prospecto_id: Number(prospectoId), ...d });
      const r = await api.disenoAPropuesta(Number(prospectoId));
      setAviso(`Propuesta ${r.propuesta?.numero || ''} creada en borrador con ${r.lineas} lineas. Revisela en Captacion en frio.`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la propuesta.');
    } finally {
      setGuardando(false);
    }
  }

  // --- Operaciones sobre los datos (el equivalente al store de la app local) --
  const addItem = (nombre) => setD((x) => ({ ...x, items_json: [...x.items_json, nuevoItem(nombre)] }));
  const setItem = (id, parche) => setD((x) => ({
    ...x,
    items_json: x.items_json.map((i) => (i.id === id ? { ...i, ...(typeof parche === 'function' ? parche(i) : parche) } : i)),
  }));
  const quitarItem = (id) => setD((x) => ({ ...x, items_json: x.items_json.filter((i) => i.id !== id) }));

  const addAvatar = (nombre) => setD((x) => ({ ...x, avatares_json: [...x.avatares_json, nuevoAvatar(nombre)] }));
  const setAvatar = (id, parche) => setD((x) => ({
    ...x,
    avatares_json: x.avatares_json.map((a) => (a.id === id ? { ...a, ...parche } : a)),
  }));
  const quitarAvatar = (id) => setD((x) => ({ ...x, avatares_json: x.avatares_json.filter((a) => a.id !== id) }));

  const setCampo = (ambito, clave, valor) => setD((x) => ({ ...x, [ambito]: { ...x[ambito], [clave]: valor } }));

  const nicho = buscarNicho(d.nicho);
  const items = d.items_json;
  const r = useMemo(() => resumen(items), [items]);

  const avance = useMemo(() => {
    const comunes = CAMPOS_AGENTE.flatMap((s) => s.campos);
    const total = comunes.length + (nicho?.campos.length || 0);
    const hechos =
      comunes.filter((c) => (d.brief_comun[c.clave] || '').trim()).length +
      (nicho?.campos.filter((c) => (d.brief_nicho[c.clave] || '').trim()).length || 0);
    const faltan = comunes
      .filter((c) => IMPRESCINDIBLES.includes(c.clave) && !(d.brief_comun[c.clave] || '').trim())
      .map((c) => c.etiqueta);
    return { total, hechos, faltan };
  }, [d, nicho]);

  const cliente = prospecto ? (prospecto.empresa || prospecto.nombre || `Prospecto ${prospectoId}`) : `Prospecto ${prospectoId}`;

  if (cargando) return <div className="empty">Cargando Offer Lab...</div>;

  return (
    <div className={`offerlab ${presentacion ? 'presentacion' : ''}`} style={{ margin: -24, minHeight: 'calc(100vh - 0px)' }}>
      {error && (
        <p role="alert" className="b2 bg-amarillo t-dato negra" style={{ margin: 0, padding: '8px 16px', textAlign: 'center' }}>{error}</p>
      )}
      {aviso && (
        <p role="status" className="b2 bg-amarillo t-dato negra" style={{ margin: 0, padding: '8px 16px', textAlign: 'center' }}>{aviso}</p>
      )}

      <header className="no-imprimir bg-tinta">
        <div style={{ margin: '0 auto', display: 'flex', maxWidth: 1152, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}>
          <h1 className="t-titulo negra mayus" style={{ margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Offer<span className="bg-amarillo" style={{ marginLeft: 2, padding: '0 6px' }}>Lab</span>
          </h1>

          <div className="no-png" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span className="t-dato negra mayus" style={{ padding: '0 8px' }}>{cliente}</span>
            <button onClick={() => navigate('/prospeccion')} className="b2 pulsable bg-papel t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>
              Volver
            </button>
            <button onClick={guardar} disabled={guardando} className="b2 pulsable bg-amarillo t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={crearPropuesta} disabled={guardando || items.length === 0} className="b2 pulsable bg-papel t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>
              Crear propuesta
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p className="t-dato" style={{ margin: 0, fontWeight: 500 }}>
              {r.elementos} {r.elementos === 1 ? 'servicio' : 'servicios'} · <strong className="negra cifras">{money(r.precioOferta)}</strong>
            </p>
            <button
              onClick={() => setPresentacion((v) => !v)}
              aria-pressed={presentacion}
              title="Oculta los controles de edicion para ensenar la pantalla"
              className={`b2 pulsable t-micro negra mayus track-sm ${presentacion ? 'bg-amarillo' : 'bg-tinta'}`}
              style={{ minHeight: 36, padding: '0 12px' }}
            >
              {presentacion ? '● Presentando' : 'Presentar'}
            </button>
          </div>
        </div>

        <nav style={{ margin: '0 auto', maxWidth: 1152, padding: '0 16px' }}>
          {/* min-w-0: sin esto, en un movil los botones no pueden encoger por
              debajo de su texto y empujan la pagina entera hacia la derecha. */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PESTANAS.length}, minmax(0, 1fr))` }}>
            {PESTANAS.map((p, n) => {
              const activa = p.id === pestana;
              return (
                <button
                  key={p.id}
                  onClick={() => setPestana(p.id)}
                  aria-current={activa ? 'page' : undefined}
                  className={`b2 t-dato negra mayus ${activa ? 'bg-amarillo' : 'bg-tinta'}`}
                  style={{
                    marginLeft: n === 0 ? 0 : -2, minWidth: 0, overflowWrap: 'break-word',
                    borderBottom: 0, padding: '12px 8px', lineHeight: 1.15, letterSpacing: '0.04em',
                    borderColor: activa ? '#000' : '#fff',
                  }}
                >
                  {p.texto}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="no-imprimir" style={{ borderBottom: '2px solid #000' }} />

      <main style={{ margin: '0 auto', maxWidth: 1152, padding: '32px 16px' }}>
        {pestana === 'brief' && (
          <Brief
            d={d} setD={setD} setCampo={setCampo} nicho={nicho} avance={avance}
            cliente={cliente} ciudad={prospecto?.ciudad}
          />
        )}
        {pestana === 'pricing' && (
          <SmartPricing
            items={items} addItem={addItem} setItem={setItem} quitarItem={quitarItem}
            cliente={cliente} fecha={undefined}
          />
        )}
        {pestana === 'oferta' && (
          <FrontBack items={items} addItem={addItem} setItem={setItem} cliente={cliente} fecha={undefined} />
        )}
        {pestana === 'avatares' && (
          <Avatares
            avatares={d.avatares_json} addAvatar={addAvatar} setAvatar={setAvatar} quitarAvatar={quitarAvatar}
            cliente={cliente} fecha={undefined}
          />
        )}
      </main>

      <footer className="no-png" style={{ margin: '0 auto', maxWidth: 1152, padding: '0 16px 40px' }}>
        <p className="t-dato" style={{ borderTop: '2px solid #000', paddingTop: 12, fontWeight: 500 }}>
          Se guarda en la ficha del prospecto al pulsar «Guardar». De aqui bebe la propuesta con IA.
        </p>
      </footer>
    </div>
  );
}

/* --- Brief del agente -------------------------------------------------------
   Esta pestana no viene de Offer Lab: es lo propio de la agencia (que agente
   de IA hay que montarle a este negocio, por sector). Se queda con la misma
   estetica para que no cante al lado de las otras tres. */
function Brief({ d, setD, setCampo, nicho, avance, cliente, ciudad }) {
  return (
    <section>
      <Titular
        titulo="Brief del agente"
        apunte={`Lo que hay que sacarle a ${cliente}${ciudad ? ` (${ciudad})` : ''} para poder construirle el agente.`}
        derecha={
          <div className="b2 bg-papel" style={{ padding: '8px 12px' }}>
            <span className="t-micro negra mayus track" style={{ display: 'block' }}>Respondido</span>
            <span className="t-cifra negra cifras" style={{ lineHeight: 1 }}>{avance.hechos} / {avance.total}</span>
          </div>
        }
      />

      <div className="b2 bg-papel" style={{ marginBottom: 16, padding: 16 }}>
        <label style={{ display: 'block', maxWidth: 420 }}>
          <span className="t-micro negra mayus track" style={{ display: 'block', marginBottom: 4 }}>Sector del negocio</span>
          <select
            value={d.nicho}
            onChange={(e) => setD((x) => ({ ...x, nicho: e.target.value }))}
            className="t-cuerpo negra"
            style={{ height: 44, width: '100%' }}
          >
            <option value="">Elija el sector…</option>
            {NICHOS.map((n) => <option key={n.id} value={n.id}>{n.etiqueta}</option>)}
          </select>
        </label>
        {!nicho && <p className="t-dato" style={{ margin: '8px 0 0', fontWeight: 500 }}>Al elegirlo aparecen las preguntas propias de ese negocio.</p>}
      </div>

      {avance.faltan.length > 0 && (
        <p role="alert" className="b2 bg-amarillo t-cuerpo negra" style={{ marginBottom: 16, padding: '10px 14px' }}>
          Sin esto no se puede construir el agente: {avance.faltan.join(' · ')}
        </p>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {CAMPOS_AGENTE.map((s) => (
          <Seccion key={s.id} titulo={s.titulo} porQue={s.porQue} campos={s.campos}
            valores={d.brief_comun} onCambio={(k, v) => setCampo('brief_comun', k, v)} />
        ))}
        {nicho && (
          <Seccion titulo={`Propio de: ${nicho.etiqueta}`} porQue="Lo que solo hace falta preguntar en este sector."
            campos={nicho.campos} valores={d.brief_nicho} onCambio={(k, v) => setCampo('brief_nicho', k, v)} destacada />
        )}
      </div>
    </section>
  );
}

function Seccion({ titulo, porQue, campos, valores, onCambio, destacada }) {
  const hechos = campos.filter((c) => (valores[c.clave] || '').trim()).length;
  return (
    <details className={`b2 ${destacada ? 'dura-sm bg-amarillo' : 'bg-papel'}`}>
      <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}>
        <span className="t-rotulo negra mayus" style={{ lineHeight: 1.15, letterSpacing: '-0.02em' }}>{titulo}</span>
        <span className="t-dato negra cifras">{hechos} / {campos.length}</span>
      </summary>
      <div style={{ borderTop: '2px solid #000', padding: 16 }}>
        <p className="t-dato" style={{ margin: '0 0 12px', fontWeight: 500 }}>{porQue}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {campos.map((c) => (
            <Campo key={c.clave} campo={c} valor={valores[c.clave] || ''} onCambio={(v) => onCambio(c.clave, v)} />
          ))}
        </div>
      </div>
    </details>
  );
}

function Campo({ campo, valor, onCambio }) {
  if (campo.tipo === 'opciones') {
    const marcadas = valor ? valor.split(' · ') : [];
    const alternar = (o) => {
      if (campo.unica) return onCambio(marcadas.includes(o) ? '' : o);
      onCambio((marcadas.includes(o) ? marcadas.filter((m) => m !== o) : [...marcadas, o]).join(' · '));
    };
    return (
      <div>
        <span className="t-micro negra mayus track" style={{ display: 'block', marginBottom: 6 }}>{campo.etiqueta}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {campo.opciones.map((o) => (
            <button
              key={o}
              onClick={() => alternar(o)}
              aria-pressed={marcadas.includes(o)}
              className={`b2 pulsable t-dato negra ${marcadas.includes(o) ? 'bg-azul' : 'bg-papel'}`}
              style={{ minHeight: 36, padding: '0 10px' }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label style={{ display: 'block' }}>
      <span className="t-micro negra mayus track" style={{ display: 'block', marginBottom: 4 }}>{campo.etiqueta}</span>
      {campo.tipo === 'area'
        ? <AreaTexto valor={valor} onCambio={onCambio} placeholder={campo.pista || ''} />
        : <Texto valor={valor} onCambio={onCambio} placeholder={campo.pista || ''} />}
    </label>
  );
}
