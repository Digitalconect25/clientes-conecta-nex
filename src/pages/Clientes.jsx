import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [pagosTodos, setPagosTodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroPago, setFiltroPago] = useState('Todos');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [cs, ps] = await Promise.all([api.clientesList(), api.pagosList()]);
      setClientes(cs);
      setPagosTodos(ps);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
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

  // Calcula el estado de pago de un cliente
  function estadoPagoCliente(clienteId) {
    const pagosCli = pagosTodos.filter(p => p.cliente_id === clienteId);
    if (pagosCli.length === 0) return { color: 'blanco', etiqueta: 'Sin pagos', pendiente: 0 };
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vencidos = pagosCli.filter(p => p.estado === 'Pendiente' && p.fecha_esperada && new Date(p.fecha_esperada) < hoy);
    const pendientes = pagosCli.filter(p => p.estado === 'Pendiente');
    const importeVencido = vencidos.reduce((s, p) => s + Number(p.importe), 0);
    const importePendiente = pendientes.reduce((s, p) => s + Number(p.importe), 0);
    if (vencidos.length > 0) return { color: 'rojo', etiqueta: `Vencido: ${fmtEuros(importeVencido)}`, pendiente: importeVencido };
    if (pendientes.length > 0) return { color: 'amarillo', etiqueta: `Pendiente: ${fmtEuros(importePendiente)}`, pendiente: importePendiente };
    return { color: 'verde', etiqueta: 'Al dia', pendiente: 0 };
  }

  const filtrados = clientes.filter((c) => {
    if (filtroEstado !== 'Todos' && c.estado !== filtroEstado) return false;
    if (filtroPago !== 'Todos') {
      const ep = estadoPagoCliente(c.id);
      if (ep.color !== filtroPago) return false;
    }
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
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 180 }}>
            <option value="Todos">Estado: Todos</option>
            <option>Pendiente firma</option>
            <option>Firmado</option>
            <option>En curso</option>
            <option>Entregado</option>
            <option>Cancelado</option>
          </select>
          <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value)} style={{ width: 180 }}>
            <option value="Todos">Pagos: Todos</option>
            <option value="rojo">Solo morosos</option>
            <option value="amarillo">Pendientes (al corriente)</option>
            <option value="verde">Al dia</option>
            <option value="blanco">Sin pagos</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 15, marginBottom: 15, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fee2e2', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #fca5a5' }}></span> Pago vencido (moroso)</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef3c7', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #fde68a' }}></span> Pago pendiente (en plazo)</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#d1fae5', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #a7f3d0' }}></span> Al dia</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fff', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #e5e7eb' }}></span> Sin pagos</span>
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
                <th>Pagos</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const ep = estadoPagoCliente(c.id);
                const fondo = {
                  rojo: '#fef2f2',
                  amarillo: '#fffbeb',
                  verde: '#f0fdf4',
                  blanco: '#fff',
                }[ep.color];
                const borde = {
                  rojo: '4px solid #dc2626',
                  amarillo: '4px solid #f59e0b',
                  verde: '4px solid #047857',
                  blanco: '4px solid transparent',
                }[ep.color];
                return (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer', background: fondo, borderLeft: borde }}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                  >
                    <td><code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>{c.numero_cliente}</code></td>
                    <td><strong>{c.nombre}</strong>{c.email && <div style={{ color: '#6b7280', fontSize: 11 }}>{c.email}</div>}</td>
                    <td>{c.nif}</td>
                    <td><span className={`estado ${claseEstado(c.estado)}`}>{c.estado}</span></td>
                    <td style={{ fontSize: 12, fontWeight: 500, color: ep.color === 'rojo' ? '#991b1b' : ep.color === 'amarillo' ? '#92400e' : ep.color === 'verde' ? '#166534' : '#6b7280' }}>{ep.etiqueta}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtEuros(c.total)}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(c.creado_en).toLocaleDateString('es-ES')}</td>
                  </tr>
                );
              })}
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
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 15 }}>
            Datos basicos para crear el cliente. Despues podras anadir servicios, generar contratos, etc.
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
