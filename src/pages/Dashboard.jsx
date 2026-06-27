import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [emisor, setEmisor] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.clientesList(), api.pagosList(), api.emisorGet()])
      .then(([cs, ps, em]) => { setClientes(cs); setPagos(ps); setEmisor(em); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="empty">Cargando...</div>;

  const totalClientes = clientes.length;
  // Normaliza igual que Proyectos (minúsculas, sin tildes) para tolerar variantes.
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const enProceso = clientes.filter(c => ['en curso', 'en revision por cliente'].includes(norm(c.estado_proyecto))).length;
  const finalizados = clientes.filter(c => norm(c.estado_proyecto) === 'entregado y aceptado').length;

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);

  const cobradoMes = pagos.filter(p => p.estado === 'Cobrado' && p.fecha_pago && new Date(p.fecha_pago) >= inicioMes && new Date(p.fecha_pago) <= finMes).reduce((s, p) => s + Number(p.importe), 0);
  const pendiente = pagos.filter(p => p.estado === 'Pendiente').reduce((s, p) => s + Number(p.importe), 0);
  const vencidos = pagos.filter(p => p.estado === 'Pendiente' && p.fecha_esperada && new Date(p.fecha_esperada) < hoy);
  const importeVencido = vencidos.reduce((s, p) => s + Number(p.importe), 0);

  // MRR (ingresos recurrentes mensuales)
  const recurrentesActivos = pagos.filter(p => p.es_recurrente && p.fecha_esperada && new Date(p.fecha_esperada) >= inicioMes && new Date(p.fecha_esperada) <= finMes);
  const mrr = recurrentesActivos.reduce((s, p) => s + Number(p.importe), 0);

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

      {vencidos.length > 0 && (
        <div className="alerta alerta-error">
          <strong>Atencion:</strong> tienes {vencidos.length} cobro(s) vencido(s) por {fmtEuros(importeVencido)}. Revisa la pestana Pagos en cada cliente.
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Resumen del negocio</h2>
      <div className="dashboard-stats">
        <div className="stat-card"><div className="label">Clientes totales</div><div className="valor">{totalClientes}</div></div>
        <div className="stat-card"><div className="label">En proceso</div><div className="valor">{enProceso}</div></div>
        <div className="stat-card"><div className="label">Finalizados</div><div className="valor">{finalizados}</div></div>
      </div>

      <h2 style={{ marginTop: 25 }}>Pagos</h2>
      <div className="dashboard-stats">
        <div className="stat-card"><div className="label">Cobrado este mes</div><div className="valor">{fmtEuros(cobradoMes)}</div></div>
        <div className="stat-card"><div className="label">Pendiente de cobrar</div><div className="valor">{fmtEuros(pendiente)}</div></div>
        <div className="stat-card"><div className="label">Vencido</div><div className="valor" style={{ color: importeVencido > 0 ? 'var(--rojo)' : 'var(--verde)' }}>{fmtEuros(importeVencido)}</div></div>
        <div className="stat-card"><div className="label">MRR (recurrente mensual)</div><div className="valor">{fmtEuros(mrr)}</div></div>
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
            <thead><tr><th>Numero</th><th>Cliente</th><th>Estado</th><th>Proyecto</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {recientes.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td><code style={{ background: 'var(--gris-2)', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>{c.numero_cliente}</code></td>
                  <td><strong>{c.nombre}</strong></td>
                  <td><span className={`estado ${claseEstado(c.estado)}`}>{c.estado}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gris-5)' }}>{c.estado_proyecto || 'Sin iniciar'}{c.porcentaje_avance > 0 ? ` (${c.porcentaje_avance}%)` : ''}</td>
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
