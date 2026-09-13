// Offer Lab dentro del CRM, para UN prospecto.
//
// Es la herramienta de ~/smart-offer-lab portada entera: mismas cinco pestanas
// (Ficha, Precios, Front / Back, Avatares, Propuesta), misma estetica (cuatro
// colores, bordes de 2px, sombras duras, tipografia negra), mismo modo
// «Presentar», mismas descargas a PNG y mismo PDF hecho por el navegador.
//
// Lo unico que cambia es donde se guarda: alli era el navegador de un solo
// ordenador, aqui es Neon (tabla diseno_oferta), para que el trabajo no se
// pierda y pueda alimentar la propuesta con IA del CRM.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money, nuevoAvatar, nuevoItem, resumen } from '../lib/offerlab.js';
import { Ficha } from '../paneles/Ficha.jsx';
import { SmartPricing } from '../paneles/SmartPricing.jsx';
import { FrontBack } from '../paneles/FrontBack.jsx';
import { Avatares } from '../paneles/Avatares.jsx';
import { Propuesta } from '../paneles/Propuesta.jsx';
import { RedDeSeguridad } from '../paneles/RedDeSeguridad.jsx';
import '../styles/offerlab.css';

const PESTANAS = [
  { id: 'ficha', texto: 'Ficha' },
  { id: 'pricing', texto: 'Precios' },
  { id: 'oferta', texto: 'Front / Back' },
  { id: 'avatares', texto: 'Avatares' },
  { id: 'propuesta', texto: 'Propuesta' },
];

const VACIO = { nicho: '', brief_comun: {}, brief_nicho: {}, items_json: [], avatares_json: [], ficha_json: {} };

export default function Diseno() {
  const { prospectoId } = useParams();
  const navigate = useNavigate();
  const [prospecto, setProspecto] = useState(null);
  const [prospectos, setProspectos] = useState([]);
  const [emisor, setEmisor] = useState(null);
  const [d, setD] = useState(VACIO);
  const [creada, setCreada] = useState(null);
  const [pestana, setPestana] = useState('ficha');
  const [presentacion, setPresentacion] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [prospectoId]);

  // Cargar una copia de seguridad desde la pestana Ficha. Se expone asi para no
  // tener que bajar la funcion por cinco niveles de props.
  useEffect(() => {
    window.__offerlabImportar = (texto) => {
      try {
        const j = JSON.parse(texto);
        setD({
          nicho: String(j.nicho || ''),
          brief_comun: j.brief_comun || {},
          brief_nicho: j.brief_nicho || {},
          items_json: Array.isArray(j.items_json) ? j.items_json : [],
          avatares_json: Array.isArray(j.avatares_json) ? j.avatares_json : [],
          ficha_json: j.ficha_json || {},
        });
        return { mensaje: 'Copia cargada. Pulse «Guardar» para dejarla fija.' };
      } catch {
        return { mensaje: 'Ese archivo no es una copia valida de Offer Lab.' };
      }
    };
    return () => { delete window.__offerlabImportar; };
  }, []);

  async function cargar() {
    setCargando(true); setError('');
    try {
      // La lista va siempre: es la que alimenta el selector de la cabecera, el
      // equivalente al desplegable de fichas que tenia la version local.
      const [lista, em] = await Promise.all([
        api.prospectosList().catch(() => []),
        api.emisorGet().catch(() => null),
      ]);
      setProspectos(Array.isArray(lista) ? lista : (lista?.prospectos || []));
      setEmisor(em?.emisor || em || null);

      // Se entra por el menu, sin cliente elegido todavia.
      if (!prospectoId) { setProspecto(null); setCreada(null); setD(VACIO); return; }

      const [p, dis] = await Promise.all([
        api.prospectoGet(prospectoId).catch(() => null),
        api.disenoGet(prospectoId),
      ]);
      setProspecto(p?.prospecto || p || null);
      setCreada(dis.creado_en || null);
      setD({
        nicho: dis.nicho || '',
        brief_comun: dis.brief_comun || {},
        brief_nicho: dis.brief_nicho || {},
        items_json: Array.isArray(dis.items_json) ? dis.items_json : [],
        avatares_json: Array.isArray(dis.avatares_json) ? dis.avatares_json : [],
        ficha_json: dis.ficha_json || {},
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
  const setFicha = (parche) => setD((x) => ({ ...x, ficha_json: { ...x.ficha_json, ...parche } }));
  const vaciar = () => setD({ ...VACIO });

  const items = d.items_json;
  const r = useMemo(() => resumen(items), [items]);
  const cliente = prospecto ? (prospecto.empresa || prospecto.nombre || `Prospecto ${prospectoId}`) : `Prospecto ${prospectoId}`;

  if (cargando) return <div className="empty">Cargando Offer Lab...</div>;

  const comunes = { cliente, fecha: creada };

  return (
    <div className={`offerlab ${presentacion ? 'presentacion' : ''}`} style={{ margin: -24 }}>
      {error && <p role="alert" className="b2 bg-amarillo t-dato negra no-imprimir" style={{ margin: 0, padding: '8px 16px', textAlign: 'center' }}>{error}</p>}
      {aviso && <p role="status" className="b2 bg-amarillo t-dato negra no-imprimir" style={{ margin: 0, padding: '8px 16px', textAlign: 'center' }}>{aviso}</p>}

      <header className="no-imprimir bg-tinta">
        <div style={{ margin: '0 auto', display: 'flex', maxWidth: 1152, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}>
          <h1 className="t-titulo negra mayus" style={{ margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Offer<span className="bg-amarillo" style={{ marginLeft: 2, padding: '0 6px' }}>Lab</span>
          </h1>

          <div className="no-png" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {/* Cambiar de cliente sin salir: es el desplegable de fichas que
                tenia la version local, con los prospectos de la agencia. */}
            <label htmlFor="ol-cliente" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Cliente</label>
            <select
              id="ol-cliente"
              value={prospectoId || ''}
              onChange={(e) => navigate(e.target.value ? `/diseno/${e.target.value}` : '/diseno')}
              className="t-dato negra"
              style={{ height: 36, maxWidth: 260 }}
            >
              <option value="">Elija un cliente…</option>
              {prospectos.map((p) => (
                <option key={p.id} value={p.id}>{p.empresa || p.nombre || `Prospecto ${p.id}`}</option>
              ))}
            </select>
            <button onClick={() => navigate('/prospeccion')} className="b2 pulsable bg-papel t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>Volver</button>
            <button onClick={guardar} disabled={guardando || !prospectoId} className="b2 pulsable bg-amarillo t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={crearPropuesta} disabled={guardando || !prospectoId || items.length === 0} className="b2 pulsable bg-papel t-micro negra mayus track-sm" style={{ minHeight: 36, padding: '0 12px' }}>
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
          {/* minWidth 0: sin esto, en un movil los cinco botones no pueden encoger
              por debajo de su texto y empujan la pagina entera a la derecha. */}
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

      {/* Ctrl+P desde una pestana de trabajo sacaba por impresora cosas internas
          (el scorecard, los margenes). Fuera de «Propuesta» no se imprime nada. */}
      {pestana !== 'propuesta' && (
        <p className="solo-imprimir t-cuerpo negra" style={{ padding: 32 }}>
          Esta pantalla es de trabajo interno y no se imprime. La propuesta del cliente esta en la
          pestana «Propuesta», con su boton «Guardar en PDF».
        </p>
      )}

      <main className={pestana === 'propuesta' ? '' : 'no-imprimir'} style={{ margin: '0 auto', maxWidth: 1152, padding: '32px 16px' }}>
        {/* Una red por pestana: si una herramienta falla, las otras siguen
            funcionando. La `key` reinicia la red al cambiar de pestana. */}
        {!prospectoId ? (
          <div className="b2 bg-papel" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p className="t-rotulo negra mayus" style={{ margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>Elija un cliente para empezar</p>
            <p className="t-dato" style={{ margin: '8px auto 0', maxWidth: 420, fontWeight: 500 }}>
              Use el desplegable de arriba. Cada cliente tiene su propia ficha, sus precios, su
              reparto Front / Back, sus avatares y su propuesta.
            </p>
          </div>
        ) : (
        <RedDeSeguridad key={pestana} ambito={PESTANAS.find((p) => p.id === pestana)?.texto} datos={() => d}>
          {pestana === 'ficha' && (
            <Ficha d={d} setD={setD} setCampo={setCampo} setFicha={setFicha} items={items} onVaciar={vaciar} {...comunes} />
          )}
          {pestana === 'pricing' && (
            <SmartPricing items={items} addItem={addItem} setItem={setItem} quitarItem={quitarItem} {...comunes} />
          )}
          {pestana === 'oferta' && (
            <FrontBack items={items} addItem={addItem} setItem={setItem} {...comunes} />
          )}
          {pestana === 'avatares' && (
            <Avatares avatares={d.avatares_json} addAvatar={addAvatar} setAvatar={setAvatar} quitarAvatar={quitarAvatar} {...comunes} />
          )}
          {pestana === 'propuesta' && (
            <Propuesta items={items} ficha={d.ficha_json} setFicha={setFicha} emisor={emisor} {...comunes} />
          )}
        </RedDeSeguridad>
        )}
      </main>

      <footer className="no-png no-imprimir" style={{ margin: '0 auto', maxWidth: 1152, padding: '0 16px 40px' }}>
        <p className="t-dato" style={{ borderTop: '2px solid #000', paddingTop: 12, fontWeight: 500 }}>
          Se guarda en la ficha del prospecto al pulsar «Guardar». De aqui bebe la propuesta con IA.
        </p>
      </footer>
    </div>
  );
}
