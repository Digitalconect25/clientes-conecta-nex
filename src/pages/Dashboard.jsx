import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [emisor, setEmisor] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.clientesList(), api.emisorGet()])
      .then(([cs, em]) => { setClientes(cs); setEmisor(em); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="empty">Cargando...</div>;

  const totalClientes = clientes.length;
  const totalFacturado = clientes.reduce((s, c) => s + Number(c.total || 0), 0);
  const pendientes = clientes.filter((c) => c.estado === 'Pendiente firma').length;
  const firmados = clientes.filter((c) => c.estado === 'Firmado').length;
  const recientes = clientes.slice(0, 5);

  const sinDatos = !emisor?.nif || emisor.nif.length < 5;

  return (
    <div>
      <div className="main-header">
        <h1>Dashboard</h1>
        <button className="btn-primary" onClick={() => navigate('/clientes')}>+ Nuevo cliente</button>
      </div>

      {sinDatos && (
        <div className="alerta alerta-aviso">
          Antes de generar contratos rellena tus datos fiscales en <Link to="/emisor">Mis datos</Link>.
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card"><div className="label">Total clientes</div><div className="valor">{totalClientes}</div></div>
        <div className="stat-card"><div className="label">Facturado total</div><div className="valor">{fmtEuros(totalFacturado)}</div></div>
        <div className="stat-card"><div className="label">Pendientes firma</div><div className="valor">{pendientes}</div></div>
        <div className="stat-card"><div className="label">Firmados</div><div className="valor">{firmados}</div></div>
      </div>

      <div className="card">
        <h2>Clientes recientes</h2>
        {recientes.length === 0 ? (
          <div className="empty">
            <p>No hay clientes todavia.</p>
            <button className="btn-primary" style={{ marginTop: 15 }} onClick={() => navigate('/clientes')}>Crear el primero</button>
          </div>
        ) : (
          <table>
            <thead><tr><th>Numero</th><th>Cliente</th><th>Estado</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {recientes.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td><code style={{ background: 'var(--gris-2)', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>{c.numero_cliente}</code></td>
                  <td><strong>{c.nombre}</strong></td>
                  <td><span className={`estado ${claseEstado(c.estado)}`}>{c.estado}</span></td>
                  <td style={{ textAlign: 'right', color: 'var(--verde)', fontWeight: 600 }}>{fmtEuros(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
