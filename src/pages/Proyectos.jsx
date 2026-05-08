import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const COLUMNAS = [
  { estado: 'Sin iniciar', color: '#9ca3af' },
  { estado: 'En curso', color: '#3b82f6' },
  { estado: 'En revision por cliente', color: '#a855f7' },
  { estado: 'Pausado', color: '#f59e0b' },
  { estado: 'Entregado y aceptado', color: '#10b981' },
  { estado: 'Cancelado', color: '#6b7280' },
];

export default function Proyectos() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [fases, setFases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [cs, fs] = await Promise.all([api.clientesList(), api.fasesList()]);
      setClientes(cs);
      setFases(fs);
    } catch (err) {
      alert('Error cargando proyectos: ' + err.message);
    } finally {
      setCargando(false);
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

  const clientesFiltrados = clientes.filter(c => {
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return (c.nombre || '').toLowerCase().includes(q) || (c.numero_cliente || '').toLowerCase().includes(q);
  });

  if (cargando) return <div style={{ padding: 40 }}>Cargando proyectos...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Proyectos en curso</h1>
        <input
          placeholder="Buscar cliente..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      <div className="kanban">
        {COLUMNAS.map(col => {
          const items = clientesFiltrados.filter(c => (c.estado_proyecto || 'Sin iniciar') === col.estado);
          return (
            <div key={col.estado} className="kanban-col">
              <div className="kanban-col-cabecera" style={{ borderTop: `3px solid ${col.color}` }}>
                <strong>{col.estado}</strong>
                <span className="kanban-contador">{items.length}</span>
              </div>
              <div className="kanban-tarjetas">
                {items.length === 0 ? (
                  <div className="kanban-vacio">Sin proyectos</div>
                ) : items.map(c => {
                  const cf = fasesPorCliente.get(c.id) || [];
                  const enCurso = cf.find(f => f.estado === 'En curso');
                  const bloqueada = cf.find(f => f.estado === 'Bloqueada');
                  return (
                    <div
                      key={c.id}
                      className="kanban-tarjeta"
                      onClick={() => navigate(`/clientes/${c.id}`)}
                    >
                      <div className="kt-nombre">{c.nombre}</div>
                      <div className="kt-numero">{c.numero_cliente}</div>
                      <div className="kt-progreso">
                        <div className="kt-progreso-barra" style={{ width: `${c.porcentaje_avance || 0}%`, background: col.color }}></div>
                      </div>
                      <div className="kt-meta">{c.porcentaje_avance || 0}% &middot; {cf.length} fases</div>
                      {bloqueada && <div className="kt-aviso bloqueada">Bloqueada: {bloqueada.nombre}</div>}
                      {!bloqueada && enCurso && <div className="kt-aviso curso">Ahora: {enCurso.nombre}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
