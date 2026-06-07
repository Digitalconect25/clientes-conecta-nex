import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const ESTADOS = ['pendiente', 'confirmada', 'hecha', 'cancelada'];
const COLOR = { pendiente: '#b8860b', confirmada: '#16a34a', hecha: '#64748b', cancelada: '#c0392b' };

export default function Agenda() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);
  async function cargar() {
    setCargando(true);
    try { setCitas(await api.citasList()); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }
  async function cambiarEstado(c, estado) {
    try { await api.citaUpdate({ id: c.id, estado, nota: c.nota || '' }); setCitas((xs) => xs.map((x) => x.id === c.id ? { ...x, estado } : x)); }
    catch (err) { alert('Error: ' + err.message); }
  }
  async function borrar(id) {
    if (!confirm('Borrar esta cita?')) return;
    try { await api.citaDelete(id); setCitas((xs) => xs.filter((x) => x.id !== id)); }
    catch (err) { alert('Error: ' + err.message); }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const proximas = citas.filter((c) => c.fecha >= hoy && c.estado !== 'cancelada');
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };

  return (
    <div>
      <h1>Agenda</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>Citas reservadas por los prospectos y clientes desde el boton "Agendar" del email.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 26, fontWeight: 800 }}>{proximas.length}</div><div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase' }}>Proximas citas</div></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 26, fontWeight: 800 }}>{citas.filter((c) => c.estado === 'pendiente').length}</div><div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase' }}>Pendientes de confirmar</div></div>
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        {cargando ? <p>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: '#67756c', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: 8 }}>Dia / hora</th><th>Quien</th><th>Contacto</th><th>Nota</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #eef2f0' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}><b>{c.fecha}</b><br /><span style={{ color: '#67756c' }}>{c.hora}</span></td>
                  <td>{c.nombre || c.prospecto_empresa || '-'}{c.origen === 'frio' ? <span style={{ color: '#16a34a', fontSize: 11 }}> · captacion</span> : null}</td>
                  <td>{c.email || ''}<br /><span style={{ color: '#67756c' }}>{c.telefono || ''}</span></td>
                  <td style={{ maxWidth: 180, color: '#67756c' }}>{c.nota || ''}</td>
                  <td>
                    <select value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)} style={{ color: COLOR[c.estado], fontWeight: 600 }}>
                      {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button onClick={() => borrar(c.id)} style={{ color: '#c0392b', padding: '6px 10px' }}>Borrar</button></td>
                </tr>
              ))}
              {!citas.length && <tr><td colSpan={6} style={{ padding: 12, color: '#67756c' }}>Aun no hay citas. Cuando alguien reserve desde el email, aparecera aqui.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
