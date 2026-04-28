import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

export default function Catalogo() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  useEffect(() => { cargar(); }, []);

  function cargar() {
    setCargando(true);
    api.serviciosList().then(setServicios).catch(console.error).finally(() => setCargando(false));
  }

  async function guardar(datos) {
    try {
      if (datos.id) await api.servicioUpdate(datos);
      else await api.servicioCreate(datos);
      cargar();
      setEditando(null);
      setNuevo(false);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function borrar(id) {
    if (!confirm('Borrar este servicio?')) return;
    await api.servicioDelete(id);
    cargar();
  }

  if (cargando) return <div className="empty">Cargando...</div>;

  const grupos = {};
  servicios.forEach((s) => { if (!grupos[s.categoria]) grupos[s.categoria] = []; grupos[s.categoria].push(s); });

  return (
    <div>
      <div className="main-header">
        <h1>Catalogo de servicios ({servicios.length})</h1>
        <button className="btn-primary" onClick={() => setNuevo(true)}>+ Nuevo servicio</button>
      </div>

      {Object.entries(grupos).map(([cat, items]) => (
        <div key={cat} className="card">
          <h2>{cat}</h2>
          <table>
            <thead><tr><th>Servicio</th><th>Descripcion</th><th style={{ textAlign: 'right' }}>Precio</th><th></th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.nombre}</strong></td>
                  <td style={{ color: 'var(--gris-5)', fontSize: 12 }}>{s.descripcion}</td>
                  <td style={{ textAlign: 'right', color: 'var(--verde)', fontWeight: 600 }}>{fmtEuros(s.precio)}</td>
                  <td>
                    <button className="btn-outline btn-sm" onClick={() => setEditando(s)}>Editar</button>
                    {' '}
                    <button className="btn-danger btn-sm" onClick={() => borrar(s.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {(editando || nuevo) && (
        <ModalServicio
          servicio={editando}
          onSave={guardar}
          onClose={() => { setEditando(null); setNuevo(false); }}
        />
      )}
    </div>
  );
}

function ModalServicio({ servicio, onSave, onClose }) {
  const [d, setD] = useState(servicio || { nombre: '', categoria: '', precio: 0, descripcion: '' });
  function set(k, v) { setD((x) => ({ ...x, [k]: v })); }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>{servicio ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="grid">
            <div style={{ gridColumn: 'span 2' }}>
              <label>Nombre *</label>
              <input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
            </div>
            <div>
              <label>Categoria *</label>
              <input value={d.categoria} onChange={(e) => set('categoria', e.target.value)} />
            </div>
            <div>
              <label>Precio (EUR)</label>
              <input type="number" step="0.01" value={d.precio} onChange={(e) => set('precio', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Descripcion</label>
              <textarea rows="2" value={d.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => {
            if (!d.nombre || !d.categoria) { alert('Nombre y categoria obligatorios'); return; }
            onSave(d);
          }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
