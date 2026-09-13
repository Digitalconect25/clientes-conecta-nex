// Diseno de oferta y brief del agente, para UN prospecto.
//
// Cuatro herramientas sobre los mismos datos:
//   1. Brief del agente  -> lo que hay que sacarle al cliente para construirlo
//   2. Oferta            -> elementos con precio, plazos y puntuacion (scorecard)
//   3. Front / Back      -> puerta de entrada vs ticket alto
//   4. Avatares          -> a quien va dirigido, por anillo de afinidad
//
// No es una isla: el brief entra en el prompt de la propuesta con IA
// (api/propuestas.js) y los elementos se vuelcan como lineas de propuesta.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';
import { CAMPOS_AGENTE, NICHOS, buscarNicho, CRITERIOS, TOTAL_MAX, totalPuntos, IMPRESCINDIBLES } from '../lib/nichos.js';

// El formato de euros de la casa (el mismo de Dashboard, Embudo y Clientes):
// una pantalla que ponga "2.900,50 €" al lado de otra con "2900,50 EUR" canta.
const EUR = fmtEuros;
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ANILLOS = [
  { valor: 'ideal', etiqueta: 'Cliente ideal', x: 50, y: 50 },
  { valor: 'afin', etiqueta: 'Afin', x: 50, y: 28 },
  { valor: 'lejano', etiqueta: 'Lejano', x: 50, y: 10 },
];
const anilloDe = (a) => {
  const r = Math.hypot((a.x ?? 50) - 50, (a.y ?? 50) - 50);
  return r <= 17 ? 'ideal' : r <= 32 ? 'afin' : 'lejano';
};

export default function Diseno() {
  const { prospectoId } = useParams();
  const navigate = useNavigate();
  const [prospecto, setProspecto] = useState(null);
  const [d, setD] = useState({ nicho: '', brief_comun: {}, brief_nicho: {}, items_json: [], avatares_json: [] });
  const [pestana, setPestana] = useState('brief');
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
      setAviso(`Propuesta ${r.propuesta?.numero || ''} creada en borrador con ${r.lineas} lineas. Revisala en Captacion en frio.`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la propuesta.');
    } finally {
      setGuardando(false);
    }
  }

  const nicho = buscarNicho(d.nicho);
  const items = d.items_json;

  const avance = useMemo(() => {
    const comunes = CAMPOS_AGENTE.flatMap((s) => s.campos);
    const total = comunes.length + (nicho?.campos.length || 0);
    const hechos =
      comunes.filter((c) => (d.brief_comun[c.clave] || '').trim()).length +
      (nicho?.campos.filter((c) => (d.brief_nicho[c.clave] || '').trim()).length || 0);
    const faltan = comunes.filter((c) => IMPRESCINDIBLES.includes(c.clave) && !(d.brief_comun[c.clave] || '').trim()).map((c) => c.etiqueta);
    return { total, hechos, faltan };
  }, [d, nicho]);

  const resumen = useMemo(() => {
    const valor = items.reduce((t, i) => t + Number(i.precio || 0), 0);
    const venta = items.reduce((t, i) => t + Number(i.precio_oferta > 0 ? i.precio_oferta : i.precio || 0), 0);
    return { valor, venta, ahorro: valor - venta };
  }, [items]);

  function setCampo(ambito, clave, valor) {
    setD((x) => ({ ...x, [ambito]: { ...x[ambito], [clave]: valor } }));
  }
  function setItem(id, parche) {
    setD((x) => ({ ...x, items_json: x.items_json.map((i) => (i.id === id ? { ...i, ...(typeof parche === 'function' ? parche(i) : parche) } : i)) }));
  }
  function setAvatar(id, parche) {
    setD((x) => ({ ...x, avatares_json: x.avatares_json.map((a) => (a.id === id ? { ...a, ...parche } : a)) }));
  }

  if (cargando) return <div className="empty">Cargando diseno...</div>;

  return (
    <div>
      <div className="main-header">
        <div>
          <h1>Diseno de oferta</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            {prospecto ? (prospecto.empresa || prospecto.nombre || `Prospecto ${prospectoId}`) : `Prospecto ${prospectoId}`}
            {prospecto?.ciudad ? ` · ${prospecto.ciudad}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => navigate('/prospeccion')}>Volver</button>
          <button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderLeft: '4px solid #dc2626', color: '#991b1b' }}>{error}</div>}
      {aviso && <div className="card" style={{ borderLeft: '4px solid #047857', color: '#166534' }}>{aviso}</div>}

      {/* Resumen vivo: lo que vale todo, por cuanto se vende y como va el brief */}
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Dato etiqueta="Valor de todo" valor={EUR(resumen.valor)} />
        <Dato etiqueta="Precio de la oferta" valor={EUR(resumen.venta)} destacado />
        <Dato etiqueta={resumen.ahorro > 0 ? 'Se ahorra' : 'Sin descuento'} valor={EUR(resumen.ahorro)} />
        <Dato etiqueta="Brief respondido" valor={`${avance.hechos} / ${avance.total}`} />
        <div style={{ flex: '1 1 200px', minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button onClick={crearPropuesta} disabled={guardando || items.length === 0}>
            Crear propuesta con esto
          </button>
        </div>
      </div>

      {avance.faltan.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <strong style={{ color: '#92400e' }}>Sin esto no se puede construir el agente:</strong>
          <div style={{ fontSize: 13, color: '#92400e', marginTop: 4 }}>{avance.faltan.join(' · ')}</div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['brief', 'Brief del agente'], ['oferta', 'Oferta y scorecard'], ['frontback', 'Front / Back'], ['avatares', 'Avatares']].map(([id, txt]) => (
          <button key={id} className={pestana === id ? '' : 'btn-outline'} onClick={() => setPestana(id)}>{txt}</button>
        ))}
      </div>

      {pestana === 'brief' && (
        <>
          <div className="card">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Sector del negocio</label>
            <select value={d.nicho} onChange={(e) => setD((x) => ({ ...x, nicho: e.target.value }))} style={{ minWidth: 260 }}>
              <option value="">Elija el sector...</option>
              {NICHOS.map((n) => <option key={n.id} value={n.id}>{n.etiqueta}</option>)}
            </select>
            {!nicho && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Al elegirlo aparecen las preguntas propias de ese negocio.</p>}
          </div>

          {CAMPOS_AGENTE.map((s) => (
            <Seccion key={s.id} titulo={s.titulo} porQue={s.porQue} campos={s.campos}
              valores={d.brief_comun} onCambio={(k, v) => setCampo('brief_comun', k, v)} />
          ))}
          {nicho && (
            <Seccion titulo={`Propio de: ${nicho.etiqueta}`} porQue="Lo que solo hace falta preguntar en este sector."
              campos={nicho.campos} valores={d.brief_nicho} onCambio={(k, v) => setCampo('brief_nicho', k, v)} destacada />
          )}
        </>
      )}

      {pestana === 'oferta' && (
        <div className="card">
          <AnadirLinea textoBoton="Anadir elemento" placeholder="Nombre del elemento de la oferta..."
            onAnadir={(nombre) => setD((x) => ({
              ...x,
              items_json: [...x.items_json, { id: nuevoId(), nombre, precio: 0, precio_oferta: 0, descuento_max: 20, plazos: { numero: 0, monto: 0 }, columna: 'sin-asignar', best_seller: false, puntos: { complementa: 3, objecion: 3, valor: 3, esfuerzo: 3 } }],
            }))} />

          {items.length === 0 ? (
            <div className="empty"><p>Todavia no hay elementos. Anada el primero arriba.</p></div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>
                    <th style={{ padding: '6px 8px' }}>Elemento</th>
                    <th style={{ padding: '6px 8px' }}>Precio</th>
                    <th style={{ padding: '6px 8px' }}>Oferta</th>
                    <th style={{ padding: '6px 8px' }}>Plazos</th>
                    {CRITERIOS.map((c) => <th key={c.clave} style={{ padding: '6px 8px' }} title={c.ayuda}>{c.etiqueta}</th>)}
                    <th style={{ padding: '6px 8px' }}>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '6px 8px', minWidth: 200 }}>
                        <input value={i.nombre} onChange={(e) => setItem(i.id, { nombre: e.target.value })} style={{ width: '100%' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}><Num valor={i.precio} onCambio={(v) => setItem(i.id, { precio: v })} /></td>
                      <td style={{ padding: '6px 8px' }}><Num valor={i.precio_oferta} onCambio={(v) => setItem(i.id, { precio_oferta: v })} /></td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <Num valor={i.plazos?.numero} ancho={46} onCambio={(v) => setItem(i.id, (a) => ({ plazos: { ...a.plazos, numero: Math.round(v) } }))} />
                        {' × '}
                        <Num valor={i.plazos?.monto} ancho={70} onCambio={(v) => setItem(i.id, (a) => ({ plazos: { ...a.plazos, monto: v } }))} />
                      </td>
                      {CRITERIOS.map((c) => (
                        <td key={c.clave} style={{ padding: '6px 8px' }}>
                          <select value={i.puntos?.[c.clave] ?? 3}
                            onChange={(e) => setItem(i.id, (a) => ({ puntos: { ...a.puntos, [c.clave]: parseInt(e.target.value, 10) } }))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px', fontWeight: 800 }}>{totalPuntos(i.puntos)}<span style={{ color: '#9ca3af', fontWeight: 400 }}>/{TOTAL_MAX}</span></td>
                      <td style={{ padding: '6px 8px' }}>
                        <button className="btn-outline" onClick={() => setD((x) => ({ ...x, items_json: x.items_json.filter((z) => z.id !== i.id) }))}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                La puntuacion ordena la propuesta: lo que mas puntua encabeza el documento del cliente.
              </p>
            </div>
          )}
        </div>
      )}

      {pestana === 'frontback' && (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {[
            { id: 'sin-asignar', titulo: 'Sin asignar', pie: 'Todavia sin decidir' },
            { id: 'front', titulo: 'Front Offer', pie: 'Puerta de entrada · baja friccion' },
            { id: 'back', titulo: 'Back Offer', pie: 'Ticket alto · monetizacion profunda' },
          ].map((col) => {
            const propios = items.filter((i) => (i.columna || 'sin-asignar') === col.id);
            const suma = propios.reduce((t, i) => t + Number(i.precio || 0), 0);
            return (
              <div key={col.id} className="card">
                <h3 style={{ margin: 0 }}>{col.titulo}</h3>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 10px' }}>{col.pie}</p>
                {propios.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>Vacio</p>}
                {propios.map((i) => (
                  <div key={i.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, marginBottom: 8, background: i.best_seller ? '#fffbeb' : '#fff' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{i.nombre}</div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{EUR(i.precio)}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {col.id !== 'front' && <button className="btn-outline" onClick={() => setItem(i.id, { columna: 'front' })}>→ Front</button>}
                      {col.id !== 'back' && <button className="btn-outline" onClick={() => setItem(i.id, { columna: 'back' })}>→ Back</button>}
                      {col.id !== 'sin-asignar' && <button className="btn-outline" onClick={() => setItem(i.id, { columna: 'sin-asignar' })}>Quitar</button>}
                      <button className="btn-outline" onClick={() => setItem(i.id, (a) => ({ best_seller: !a.best_seller }))}>
                        {i.best_seller ? '★ Best seller' : '☆ Best seller'}
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{propios.length} {propios.length === 1 ? 'servicio' : 'servicios'}</span>
                  <strong>{EUR(suma)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pestana === 'avatares' && (
        <div className="card">
          <AnadirLinea textoBoton="Anadir avatar" placeholder="Tipo de cliente..."
            onAnadir={(nombre) => setD((x) => ({
              ...x,
              avatares_json: [...x.avatares_json, { id: nuevoId(), nombre, dolor_corto: '', x: 50, y: 50, dolor: '', sueno: '', no: '', si: '' }],
            }))} />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            Lo que escriba aqui entra en el prompt de la propuesta: la IA usara el dolor y los motivos de NO y de SI.
          </p>

          {d.avatares_json.length === 0 ? (
            <div className="empty"><p>Sin avatares todavia.</p></div>
          ) : d.avatares_json.map((a) => (
            <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={a.nombre} onChange={(e) => setAvatar(a.id, { nombre: e.target.value })} placeholder="Nombre" style={{ flex: '1 1 220px' }} />
                <select value={anilloDe(a)} onChange={(e) => {
                  const an = ANILLOS.find((z) => z.valor === e.target.value);
                  setAvatar(a.id, { x: an.x, y: an.y });
                }}>
                  {ANILLOS.map((an) => <option key={an.valor} value={an.valor}>{an.etiqueta}</option>)}
                </select>
                <button className="btn-outline" onClick={() => setD((x) => ({ ...x, avatares_json: x.avatares_json.filter((z) => z.id !== a.id) }))}>Borrar</button>
              </div>
              <input value={a.dolor_corto} onChange={(e) => setAvatar(a.id, { dolor_corto: e.target.value })}
                placeholder="Su dolor en una frase" style={{ width: '100%', marginTop: 8 }} />
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 8 }}>
                {[['dolor', 'Su dolor'], ['sueno', 'Su sueno'], ['no', 'Que le hace decir NO'], ['si', 'Que le hace decir SI']].map(([k, etq]) => (
                  <label key={k} style={{ fontSize: 12, fontWeight: 600 }}>
                    {etq}
                    <textarea value={a[k] || ''} onChange={(e) => setAvatar(a.id, { [k]: e.target.value })} rows={2} style={{ width: '100%', marginTop: 4 }} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor, destacado }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 150, background: destacado ? '#ecfdf5' : '#f9fafb', borderLeft: `4px solid ${destacado ? '#0c7b6d' : '#d1d5db'}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: destacado ? '#0c7b6d' : '#111827', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}

function Seccion({ titulo, porQue, campos, valores, onCambio, destacada }) {
  const hechos = campos.filter((c) => (valores[c.clave] || '').trim()).length;
  return (
    <details className="card" style={destacada ? { borderLeft: '4px solid #0c7b6d' } : undefined}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
        <span>{titulo}</span>
        <span style={{ color: '#6b7280', fontWeight: 500 }}>{hechos} / {campos.length}</span>
      </summary>
      <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 8 }}>{porQue}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {campos.map((c) => (
          <Campo key={c.clave} campo={c} valor={valores[c.clave] || ''} onCambio={(v) => onCambio(c.clave, v)} />
        ))}
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
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{campo.etiqueta}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {campo.opciones.map((o) => (
            <button key={o} className={marcadas.includes(o) ? '' : 'btn-outline'} onClick={() => alternar(o)} style={{ fontSize: 12 }}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label style={{ fontSize: 12, fontWeight: 700 }}>
      {campo.etiqueta}
      {campo.tipo === 'area'
        ? <textarea value={valor} onChange={(e) => onCambio(e.target.value)} rows={3} placeholder={campo.pista || ''} style={{ width: '100%', marginTop: 4, fontWeight: 400 }} />
        : <input value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={campo.pista || ''} style={{ width: '100%', marginTop: 4, fontWeight: 400 }} />}
    </label>
  );
}

function AnadirLinea({ placeholder, textoBoton, onAnadir }) {
  const [v, setV] = useState('');
  const confirmar = () => { if (!v.trim()) return; onAnadir(v.trim()); setV(''); };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
        placeholder={placeholder} style={{ flex: '1 1 260px' }} />
      <button onClick={confirmar}>{textoBoton}</button>
    </div>
  );
}

// Campo numerico con texto propio mientras se escribe: asi se pueden teclear
// decimales con coma sin que el valor salte a 0 a mitad de escritura.
function Num({ valor, onCambio, ancho = 90 }) {
  const [texto, setTexto] = useState(String(valor ?? 0));
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(String(valor ?? 0)); }, [valor, editando]);
  return (
    <input
      value={texto}
      inputMode="decimal"
      onFocus={(e) => { setEditando(true); e.target.select(); }}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t);
        if (!t.trim()) return onCambio(0);
        const n = parseFloat(t.replace(',', '.'));
        if (Number.isFinite(n)) onCambio(Math.max(0, n));
      }}
      onBlur={() => {
        setEditando(false);
        const n = parseFloat(texto.replace(',', '.'));
        setTexto(String(Number.isFinite(n) ? Math.max(0, n) : Number(valor) || 0));
      }}
      style={{ width: ancho }}
    />
  );
}
