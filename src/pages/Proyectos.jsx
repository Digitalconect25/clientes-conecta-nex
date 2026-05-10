import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

// Columnas del kanban. ORDEN importa.
const COLUMNAS = [
  { estado: 'Sin iniciar', color: '#9ca3af' },
  { estado: 'En curso', color: '#3b82f6' },
  { estado: 'En revision por cliente', color: '#a855f7' },
  { estado: 'Pausado', color: '#f59e0b' },
  { estado: 'Entregado y aceptado', color: '#10b981' },
  { estado: 'Cancelado', color: '#6b7280' },
];

// Normaliza un estado_proyecto: minusculas, sin tildes, sin espacios extra.
function normalizar(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Mapa de estados conocidos. Cualquier valor que normalice a uno de
// estos cae en su columna correspondiente. Asi tolera 'En Curso',
// 'EN CURSO', 'En revisión por cliente' (con tilde), etc.
const MAPA_NORMALIZADO = COLUMNAS.reduce((acc, col) => {
  acc[normalizar(col.estado)] = col.estado;
  return acc;
}, {});

// Si el cliente tiene un estado_proyecto que NO encaja con ninguna columna,
// se mete en 'Sin iniciar' como fallback. Asi nunca desaparece.
function columnaParaCliente(estadoProyecto) {
  const n = normalizar(estadoProyecto);
  if (!n) return 'Sin iniciar';
  if (MAPA_NORMALIZADO[n]) return MAPA_NORMALIZADO[n];
  return 'Sin iniciar';
}

export default function Proyectos() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [fases, setFases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [vista, setVista] = useState('kanban'); // 'kanban' | 'tabla'
  const [errorCarga, setErrorCarga] = useState('');
  const [actualizando, setActualizando] = useState(null); // id del cliente que se esta actualizando

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setErrorCarga('');
    try {
      const [cs, fs] = await Promise.all([api.clientesList(), api.fasesList()]);
      setClientes(Array.isArray(cs) ? cs : []);
      setFases(Array.isArray(fs) ? fs : []);
    } catch (err) {
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function cambiarEstadoProyecto(cliente, nuevoEstado) {
    setActualizando(cliente.id);
    try {
      await api.clienteUpdate({ id: cliente.id, estado_proyecto: nuevoEstado });
      // Actualizar en local
      setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, estado_proyecto: nuevoEstado } : c));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActualizando(null);
    }
  }

  const fasesPorCliente = useMemo(() => {
    const m = new Map();
    fases.forEach(f => {
      if (!m.has(f.cliente_id)) m.set(f.cliente_id, []);
      m.get(f.cliente_id).push(f);
    });
    return m;
  }, [fases]);

  const clientesFiltrados = useMemo(() => {
    if (!filtro) return clientes;
    const q = filtro.toLowerCase();
    return clientes.filter(c => {
      return (c.nombre || '').toLowerCase().includes(q)
        || (c.numero_cliente || '').toLowerCase().includes(q)
        || (c.numero_contrato || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q);
    });
  }, [clientes, filtro]);

  // Estadisticas rapidas
  const totales = useMemo(() => {
    const t = { total: clientes.length, sinFases: 0, conAviso: 0 };
    clientes.forEach(c => {
      const f = fasesPorCliente.get(c.id) || [];
      if (f.length === 0) t.sinFases++;
      const n = normalizar(c.estado_proyecto);
      if (n && !MAPA_NORMALIZADO[n]) t.conAviso++;
    });
    return t;
  }, [clientes, fasesPorCliente]);

  if (cargando) return <div style={{ padding: 40 }}>Cargando proyectos...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Proyectos</h1>
          <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
            {totales.total} clientes en total
            {totales.sinFases > 0 && ` · ${totales.sinFases} sin pipeline`}
            {totales.conAviso > 0 && ` · ${totales.conAviso} con estado raro`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar cliente, contrato, email..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ width: 280 }}
          />
          <button
            onClick={() => setVista(vista === 'kanban' ? 'tabla' : 'kanban')}
            title="Cambiar vista"
          >
            {vista === 'kanban' ? 'Vista tabla' : 'Vista kanban'}
          </button>
          <button onClick={cargar} title="Recargar">Recargar</button>
        </div>
      </div>

      {errorCarga && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          Error cargando proyectos: {errorCarga}
        </div>
      )}

      {clientes.length === 0 && !errorCarga && (
        <div style={{ padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 8, color: '#666' }}>
          <p style={{ marginTop: 0 }}>No hay clientes todavia.</p>
          <button onClick={() => navigate('/clientes')} className="btn-principal">Ir a Clientes para crear el primero</button>
        </div>
      )}

      {clientes.length > 0 && vista === 'kanban' && (
        <VistaKanban
          clientesFiltrados={clientesFiltrados}
          fasesPorCliente={fasesPorCliente}
          actualizando={actualizando}
          onAbrir={(c) => navigate(`/clientes/${c.id}`)}
          onCambiarEstado={cambiarEstadoProyecto}
        />
      )}

      {clientes.length > 0 && vista === 'tabla' && (
        <VistaTabla
          clientesFiltrados={clientesFiltrados}
          fasesPorCliente={fasesPorCliente}
          actualizando={actualizando}
          onAbrir={(c) => navigate(`/clientes/${c.id}`)}
          onCambiarEstado={cambiarEstadoProyecto}
        />
      )}
    </div>
  );
}

// =============================================================
// VISTA KANBAN
// =============================================================
function VistaKanban({ clientesFiltrados, fasesPorCliente, actualizando, onAbrir, onCambiarEstado }) {
  return (
    <div className="kanban">
      {COLUMNAS.map(col => {
        const items = clientesFiltrados.filter(c => columnaParaCliente(c.estado_proyecto) === col.estado);
        return (
          <div key={col.estado} className="kanban-col">
            <div className="kanban-col-cabecera" style={{ borderTop: `3px solid ${col.color}` }}>
              <strong>{col.estado}</strong>
              <span className="kanban-contador">{items.length}</span>
            </div>
            <div className="kanban-tarjetas">
              {items.length === 0 ? (
                <div className="kanban-vacio">Sin proyectos</div>
              ) : items.map(c => (
                <TarjetaCliente
                  key={c.id}
                  cliente={c}
                  fases={fasesPorCliente.get(c.id) || []}
                  color={col.color}
                  actualizando={actualizando === c.id}
                  onAbrir={() => onAbrir(c)}
                  onCambiarEstado={(nuevo) => onCambiarEstado(c, nuevo)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TarjetaCliente({ cliente, fases, color, actualizando, onAbrir, onCambiarEstado }) {
  const enCurso = fases.find(f => f.estado === 'En curso');
  const bloqueada = fases.find(f => f.estado === 'Bloqueada');
  const completadas = fases.filter(f => f.estado === 'Completada').length;
  const estadoProyectoOriginal = cliente.estado_proyecto || '';
  const estadoNormalizado = normalizar(estadoProyectoOriginal);
  const estadoRaro = estadoProyectoOriginal && !MAPA_NORMALIZADO[estadoNormalizado];

  return (
    <div className="kanban-tarjeta" onClick={onAbrir}>
      <div className="kt-nombre">{cliente.nombre}</div>
      <div className="kt-numero">
        {cliente.numero_cliente}
        {cliente.numero_contrato && cliente.numero_contrato !== cliente.numero_cliente && ` · ${cliente.numero_contrato}`}
      </div>

      {cliente.estado && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, padding: '2px 6px', background: '#e5e7eb', borderRadius: 4, color: '#374151' }}>
            {cliente.estado}
          </span>
        </div>
      )}

      <div className="kt-progreso" style={{ marginTop: 8 }}>
        <div className="kt-progreso-barra" style={{ width: `${cliente.porcentaje_avance || 0}%`, background: color }}></div>
      </div>
      <div className="kt-meta">
        {cliente.porcentaje_avance || 0}% · {fases.length} fases
        {fases.length > 0 && ` · ${completadas} completadas`}
      </div>

      {bloqueada && <div className="kt-aviso bloqueada">Bloqueada: {bloqueada.nombre}</div>}
      {!bloqueada && enCurso && <div className="kt-aviso curso">Ahora: {enCurso.nombre}</div>}
      {fases.length === 0 && <div className="kt-aviso" style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin pipeline</div>}
      {estadoRaro && (
        <div className="kt-aviso" style={{ color: '#f59e0b', fontSize: 11 }}>
          Estado en BD: "{estadoProyectoOriginal}"
        </div>
      )}

      {/* Cambio rapido de estado, sin abrir el cliente */}
      <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        <select
          value={columnaParaCliente(cliente.estado_proyecto)}
          onChange={(e) => onCambiarEstado(e.target.value)}
          disabled={actualizando}
          style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
        >
          {COLUMNAS.map(c => <option key={c.estado} value={c.estado}>{c.estado}</option>)}
        </select>
      </div>
    </div>
  );
}

// =============================================================
// VISTA TABLA
// =============================================================
function VistaTabla({ clientesFiltrados, fasesPorCliente, actualizando, onAbrir, onCambiarEstado }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tabla-pagos" style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Numero</th>
            <th>Estado cliente</th>
            <th>Estado proyecto</th>
            <th>Avance</th>
            <th>Fases</th>
            <th>Email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clientesFiltrados.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: '#666' }}>Sin resultados</td></tr>
          ) : clientesFiltrados.map(c => {
            const fs = fasesPorCliente.get(c.id) || [];
            return (
              <tr key={c.id}>
                <td><strong>{c.nombre}</strong></td>
                <td>{c.numero_cliente}{c.numero_contrato && c.numero_contrato !== c.numero_cliente && ` / ${c.numero_contrato}`}</td>
                <td>{c.estado || '-'}</td>
                <td>
                  <select
                    value={columnaParaCliente(c.estado_proyecto)}
                    onChange={(e) => onCambiarEstado(c, e.target.value)}
                    disabled={actualizando === c.id}
                    style={{ fontSize: 12 }}
                  >
                    {COLUMNAS.map(col => <option key={col.estado} value={col.estado}>{col.estado}</option>)}
                  </select>
                </td>
                <td>{c.porcentaje_avance || 0}%</td>
                <td>{fs.length} ({fs.filter(f => f.estado === 'Completada').length} hechas)</td>
                <td style={{ fontSize: 12 }}>{c.email || '-'}</td>
                <td>
                  <button onClick={() => onAbrir(c)}>Abrir</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
