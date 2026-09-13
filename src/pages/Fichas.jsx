import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { SECCIONES_FICHA, seccionesActivas, renderFichaHtml } from '../lib/fichas.js';

const ESTADO_LABEL = {
  borrador: 'Borrador', enviada: 'Enviada', en_progreso: 'En progreso',
  completada: 'Completada', firmada: 'Firmada', validada: 'Validada',
};
const ESTADO_CLASE = {
  borrador: 'estado-pendiente', enviada: 'estado-pendiente', en_progreso: 'estado-curso',
  completada: 'estado-curso', firmada: 'estado-firmado', validada: 'estado-entregado',
};

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; }
}

export default function Fichas() {
  const [fichas, setFichas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [fs, cs] = await Promise.all([api.fichasList(), api.clientesList()]);
      setFichas(fs); setClientes(cs);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  }

  const filtradas = useMemo(() => fichas.filter((f) => {
    if (filtroEstado !== 'Todos' && f.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return f.cliente_nombre?.toLowerCase().includes(q) || f.titulo?.toLowerCase().includes(q);
    }
    return true;
  }), [fichas, busqueda, filtroEstado]);

  async function copiarEnlace(token) {
    const url = `${window.location.origin}/ficha/${token}`;
    try { await navigator.clipboard.writeText(url); alert('Enlace copiado:\n' + url); } catch { prompt('Copia el enlace:', url); }
  }

  async function enviarEnlace(ficha) {
    const email = prompt('¿A qué email se envía la ficha?', ficha.destinatario_email || ficha.cliente_email || '');
    if (email === null) return;
    try { await api.fichaEnviarEnlace(ficha.id, email.trim()); await cargar(); alert('Enviada.'); }
    catch (err) { alert('Error: ' + err.message); }
  }

  async function eliminar(ficha) {
    if (!confirm(`¿Eliminar la ficha "${ficha.titulo}" de ${ficha.cliente_nombre}?`)) return;
    try { await api.fichaEliminar(ficha.id); await cargar(); }
    catch (err) { alert('Error: ' + err.message); }
  }

  async function verDetalle(ficha) {
    try { setDetalle(await api.fichaGet(ficha.id)); }
    catch (err) { alert('Error: ' + err.message); }
  }

  if (cargando) return <div className="empty">Cargando...</div>;

  return (
    <div>
      <div className="main-header">
        <h1>Fichas de implementación ({fichas.length})</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Nueva ficha</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
          <input placeholder="Buscar por cliente o título..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {filtradas.length === 0 ? (
          <div className="empty">No hay fichas que coincidan.</div>
        ) : (
          <table>
            <thead><tr><th>Cliente</th><th>Título</th><th>Estado</th><th>Enviada</th><th>Firmada</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtradas.map((f) => (
                <tr key={f.id}>
                  <td>{f.cliente_nombre}</td>
                  <td>{f.titulo}</td>
                  <td><span className={`estado ${ESTADO_CLASE[f.estado] || ''}`}>{ESTADO_LABEL[f.estado] || f.estado}</span></td>
                  <td>{fmt(f.enviada_en)}</td>
                  <td>{fmt(f.fecha_firma)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-outline btn-sm" onClick={() => verDetalle(f)}>Ver</button>
                    {f.token && <button className="btn-outline btn-sm" onClick={() => copiarEnlace(f.token)}>Copiar enlace</button>}
                    {!['firmada', 'validada'].includes(f.estado) && <button className="btn-outline btn-sm" onClick={() => enviarEnlace(f)}>{f.enviada_en ? 'Reenviar' : 'Enviar'}</button>}
                    {!['firmada', 'validada'].includes(f.estado) && <button className="btn-danger btn-sm" onClick={() => eliminar(f)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <ModalNuevaFicha clientes={clientes} onClose={() => setShowModal(false)} onCreado={async () => { setShowModal(false); await cargar(); }} />}
      {detalle && <ModalDetalle ficha={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function ModalNuevaFicha({ clientes, onClose, onCreado }) {
  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('Ficha de implementación del agente IA WhatsApp');
  const [secciones, setSecciones] = useState(SECCIONES_FICHA.map((s) => s.clave));
  const [email, setEmail] = useState('');
  const [enviarAhora, setEnviarAhora] = useState(true);
  const [guardando, setGuardando] = useState(false);

  function toggleSeccion(clave) {
    setSecciones((prev) => prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]);
  }

  useEffect(() => {
    const c = clientes.find((x) => String(x.id) === String(clienteId));
    setEmail(c?.email || '');
  }, [clienteId, clientes]);

  async function crear() {
    if (!clienteId) { alert('Elige un cliente.'); return; }
    if (!secciones.length) { alert('Elige al menos un apartado.'); return; }
    setGuardando(true);
    try {
      const ficha = await api.fichaCrear({ cliente_id: parseInt(clienteId, 10), titulo, secciones });
      if (enviarAhora) await api.fichaEnviarEnlace(ficha.id, email);
      onCreado();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Nueva ficha de implementación</h2><button onClick={onClose}>×</button></div>
        <div className="modal-body">
          <label>Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
            <option value="">Elige un cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }} />

          <label>Apartados que necesita este cliente</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', margin: '6px 0 6px' }}>
            {SECCIONES_FICHA.map((s) => (
              <label key={s.clave} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={secciones.includes(s.clave)} onChange={() => toggleSeccion(s.clave)} />
                {s.numero} · {s.titulo}
              </label>
            ))}
          </div>
          <button className="btn-outline btn-sm" onClick={() => setSecciones(secciones.length === SECCIONES_FICHA.length ? [] : SECCIONES_FICHA.map((s) => s.clave))} style={{ marginBottom: 12 }}>
            {secciones.length === SECCIONES_FICHA.length ? 'Quitar todos' : 'Marcar todos'}
          </button>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
            <input type="checkbox" checked={enviarAhora} onChange={(e) => setEnviarAhora(e.target.checked)} />
            Enviar el enlace por email ahora mismo
          </label>
          {enviarAhora && (
            <input type="email" placeholder="Email del destinatario" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={crear} disabled={guardando}>{guardando ? 'Creando…' : 'Crear ficha'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalDetalle({ ficha, onClose }) {
  const secciones = seccionesActivas(ficha.secciones);
  const previa = renderFichaHtml(ficha, { nombre: ficha.cliente_nombre, nif: ficha.cliente_nif }, {}, { conFirma: !!ficha.fecha_firma });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>{ficha.titulo}</h2><button onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div style={{ marginBottom: 12, fontSize: 13.5, color: 'var(--gris-5)' }}>
            Cliente: <b>{ficha.cliente_nombre}</b> · Estado: <span className={`estado ${ESTADO_CLASE[ficha.estado] || ''}`}>{ESTADO_LABEL[ficha.estado] || ficha.estado}</span> · {secciones.length} apartado(s)
          </div>
          {ficha.fecha_firma && (
            <div className="alerta alerta-ok" style={{ marginBottom: 14 }}>
              Firmada por <b>{ficha.firmante_nombre}</b> ({ficha.firmante_cargo || 'sin cargo'}) el {fmt(ficha.fecha_firma)}.<br />
              Nº de validación: <b>{ficha.firma_ref}</b> · IP {ficha.firmante_ip}<br />
              {ficha.validado_en ? <>Validada por la agencia el {fmt(ficha.validado_en)}.</> : ficha.validacion_token ? <>Pendiente de validación por la agencia (enlace enviado por email).</> : null}
            </div>
          )}
          <div style={{ border: '1px solid var(--gris-3)', borderRadius: 10, padding: 16, maxHeight: 480, overflow: 'auto', background: '#fff' }}>
            <div dangerouslySetInnerHTML={{ __html: ficha.contenido_html || previa }} />
          </div>
        </div>
        <div className="modal-footer"><button className="btn-outline" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
