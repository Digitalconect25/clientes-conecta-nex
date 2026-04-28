import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  function cargar() {
    setCargando(true);
    api.clientesList().then(setClientes).catch(console.error).finally(() => setCargando(false));
  }

  async function handleNuevo(datos) {
    try {
      const cli = await api.clienteCreate(datos);
      setShowModal(false);
      navigate(`/clientes/${cli.id}`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const filtrados = clientes.filter((c) => {
    if (filtroEstado !== 'Todos' && c.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        c.nombre?.toLowerCase().includes(q) ||
        c.nif?.toLowerCase().includes(q) ||
        c.numero_cliente?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (cargando) return <div className="empty">Cargando...</div>;

  return (
    <div>
      <div className="main-header">
        <h1>Clientes ({clientes.length})</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Nuevo cliente</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por nombre, NIF, numero, email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 200 }}>
            <option>Todos</option>
            <option>Pendiente firma</option>
            <option>Firmado</option>
            <option>En curso</option>
            <option>Entregado</option>
            <option>Cancelado</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty">
            <p>No hay clientes con esos filtros.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Cliente</th>
                <th>NIF</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td><code style={{ background: 'var(--gris-2)', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>{c.numero_cliente}</code></td>
                  <td><strong>{c.nombre}</strong>{c.email && <div style={{ color: 'var(--gris-5)', fontSize: 11 }}>{c.email}</div>}</td>
                  <td>{c.nif}</td>
                  <td><span className={`estado ${claseEstado(c.estado)}`}>{c.estado}</span></td>
                  <td style={{ textAlign: 'right', color: 'var(--verde)', fontWeight: 600 }}>{fmtEuros(c.total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--gris-5)' }}>{new Date(c.creado_en).toLocaleDateString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <ModalNuevoCliente onClose={() => setShowModal(false)} onSave={handleNuevo} />}
    </div>
  );
}

function claseEstado(e) {
  return {
    'Pendiente firma': 'estado-pendiente',
    'Firmado': 'estado-firmado',
    'Cancelado': 'estado-cancelado',
    'En curso': 'estado-curso',
    'Entregado': 'estado-entregado',
  }[e] || 'estado-pendiente';
}

function ModalNuevoCliente({ onClose, onSave }) {
  const [datos, setDatos] = useState({
    tipo_persona: 'Fisica', nombre: '', nif: '', email: '', telefono: '',
    direccion: '', cp: '', ciudad: '', provincia: 'Alicante', pais: 'Espana',
  });

  function set(k, v) { setDatos((d) => ({ ...d, [k]: v })); }

  function submit() {
    if (!datos.nombre || !datos.nif) {
      alert('Nombre y NIF son obligatorios');
      return;
    }
    onSave({ ...datos, servicios_json: [], iva: 21 });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nuevo cliente</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--gris-5)', marginBottom: 15 }}>
            Datos basicos para crear el cliente. Despues podras anadir servicios, descripcion del proyecto, generar contratos, etc.
          </p>
          <div className="grid">
            <div>
              <label>Tipo de persona</label>
              <select value={datos.tipo_persona} onChange={(e) => set('tipo_persona', e.target.value)}>
                <option>Fisica</option>
                <option>Juridica</option>
              </select>
            </div>
            <div>
              <label>{datos.tipo_persona === 'Juridica' ? 'CIF' : 'NIF'} *</label>
              <input value={datos.nif} onChange={(e) => set('nif', e.target.value.toUpperCase())} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Nombre / Razon social *</label>
              <input value={datos.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={datos.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label>Telefono</label>
              <input value={datos.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Direccion</label>
              <input value={datos.direccion} onChange={(e) => set('direccion', e.target.value)} />
            </div>
            <div><label>CP</label><input value={datos.cp} onChange={(e) => set('cp', e.target.value)} /></div>
            <div><label>Ciudad</label><input value={datos.ciudad} onChange={(e) => set('ciudad', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit}>Crear cliente</button>
        </div>
      </div>
    </div>
  );
}
