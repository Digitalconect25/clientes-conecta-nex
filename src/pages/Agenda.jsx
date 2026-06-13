import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const ESTADOS = ['pendiente', 'confirmada', 'hecha', 'cancelada'];
const COLOR = { pendiente: '#b8860b', confirmada: '#16a34a', hecha: '#64748b', cancelada: '#c0392b' };
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function Agenda() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const hoyStr = ymd(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [diaSel, setDiaSel] = useState(hoyStr);

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
    if (!confirm('¿Borrar esta cita?')) return;
    try { await api.citaDelete(id); setCitas((xs) => xs.filter((x) => x.id !== id)); }
    catch (err) { alert('Error: ' + err.message); }
  }

  // citas agrupadas por fecha (excluye canceladas para los puntos del calendario)
  const porDia = useMemo(() => {
    const m = {};
    for (const c of citas) {
      if (c.estado === 'cancelada') continue;
      (m[c.fecha] = m[c.fecha] || []).push(c);
    }
    for (const k in m) m[k].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    return m;
  }, [citas]);

  const proximas = citas.filter((c) => c.fecha >= hoyStr && c.estado !== 'cancelada');
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };

  // construir la rejilla del mes (semanas que empiezan en lunes)
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes=0
  const diasMes = new Date(year, month + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(new Date(year, month, d));
  while (celdas.length % 7 !== 0) celdas.push(null);

  const citasDia = (porDia[diaSel] || []);

  const btn = { cursor: 'pointer', border: '1px solid #e3e8e5', background: '#fff', borderRadius: 10, padding: '8px 12px', fontWeight: 600 };

  return (
    <div>
      <h1>Agenda</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>Calendario de citas. Las reservas del Agente Nex y del formulario aparecen aquí automáticamente.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 26, fontWeight: 800 }}>{proximas.length}</div><div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase' }}>Próximas citas</div></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 26, fontWeight: 800 }}>{citas.filter((c) => c.estado === 'pendiente').length}</div><div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase' }}>Pendientes de confirmar</div></div>
      </div>

      {/* Calendario */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, textTransform: 'capitalize' }}>{MES[month]} {year}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
            <button style={btn} onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setDiaSel(ymd(d)); }}>Hoy</button>
            <button style={btn} onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
          </div>
        </div>

        {cargando ? <p>Cargando...</p> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
              {DOW.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#67756c' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
              {celdas.map((d, i) => {
                if (!d) return <div key={i} />;
                const s = ymd(d);
                const n = (porDia[s] || []).length;
                const esHoy = s === hoyStr;
                const sel = s === diaSel;
                const finde = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <button key={i} onClick={() => setDiaSel(s)} style={{
                    cursor: 'pointer', minHeight: 64, borderRadius: 10, padding: 6, textAlign: 'left',
                    border: sel ? '2px solid #16a34a' : '1px solid #eef2f0',
                    background: sel ? '#f0fdf4' : (finde ? '#fafafa' : '#fff'),
                    position: 'relative',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: esHoy ? '#16a34a' : '#1f2937' }}>
                      {d.getDate()}{esHoy ? ' •' : ''}
                    </div>
                    {n > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {(porDia[s] || []).slice(0, 3).map((c) => (
                          <span key={c.id} title={`${c.hora} ${c.nombre || ''}`} style={{ fontSize: 10, background: COLOR[c.estado] || '#999', color: '#fff', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>{c.hora}</span>
                        ))}
                        {n > 3 && <span style={{ fontSize: 10, color: '#67756c' }}>+{n - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Detalle del día seleccionado */}
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Citas del {diaSel.split('-').reverse().join('/')}</h2>
        {citasDia.length === 0 ? (
          <p style={{ color: '#67756c' }}>No hay citas este día.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', color: '#67756c', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: 8 }}>Hora</th><th>Quién</th><th>Contacto</th><th>Nota</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                {citasDia.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #eef2f0' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap', fontWeight: 700 }}>{c.hora}</td>
                    <td>{c.nombre || c.prospecto_empresa || '-'}{c.origen === 'agente' ? <span style={{ color: '#5b3fa0', fontSize: 11 }}> · agente</span> : c.origen === 'frio' ? <span style={{ color: '#16a34a', fontSize: 11 }}> · captación</span> : null}</td>
                    <td>{c.email || ''}<br /><span style={{ color: '#67756c' }}>{c.telefono || ''}</span></td>
                    <td style={{ maxWidth: 200, color: '#67756c' }}>{c.nota || ''}</td>
                    <td>
                      <select value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)} style={{ color: COLOR[c.estado], fontWeight: 600 }}>
                        {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button onClick={() => borrar(c.id)} style={{ color: '#c0392b', padding: '6px 10px', cursor: 'pointer', border: 'none', background: 'none' }}>Borrar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Próximas citas */}
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Próximas citas</h2>
        {proximas.length === 0 ? (
          <p style={{ color: '#67756c' }}>Aún no hay citas próximas. Cuando alguien reserve (Agente Nex, formulario o email), aparecerá aquí.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).map((c) => (
              <div key={c.id} onClick={() => { const [y, m] = c.fecha.split('-'); setCursor(new Date(+y, +m - 1, 1)); setDiaSel(c.fecha); }}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 10px', border: '1px solid #eef2f0', borderRadius: 10, cursor: 'pointer' }}>
                <div style={{ minWidth: 96, fontWeight: 700, color: '#1f2937' }}>{c.fecha.split('-').reverse().slice(0, 2).join('/')} · {c.hora}</div>
                <div style={{ flex: 1 }}>{c.nombre || c.prospecto_empresa || '-'} <span style={{ color: '#67756c', fontSize: 13 }}>{c.nota ? '· ' + c.nota : ''}</span></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: COLOR[c.estado], borderRadius: 20, padding: '2px 10px' }}>{c.estado}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
