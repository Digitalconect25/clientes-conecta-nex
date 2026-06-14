import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

// Tramos horarios (mismos que /api/agendar)
const HORAS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const EST = {
  pendiente: { label: 'Pendiente confirmación', color: '#b8860b', bg: '#fdf6e3' },
  confirmada: { label: 'Confirmada', color: '#16a34a', bg: '#f0fdf4' },
  hecha: { label: 'Realizada', color: '#64748b', bg: '#f1f5f9' },
  cancelada: { label: 'Cancelada', color: '#c0392b', bg: '#fef2f2' },
};
const ORDEN_EST = ['pendiente', 'confirmada', 'hecha', 'cancelada'];
const FILTROS = [
  { k: 'todas', label: 'Todas' },
  { k: 'pendiente', label: 'Pendientes' },
  { k: 'confirmada', label: 'Confirmadas' },
  { k: 'hecha', label: 'Realizadas' },
  { k: 'cancelada', label: 'Canceladas' },
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function soloFecha(s) {
  return String(s || '').slice(0, 10); // tolera 'YYYY-MM-DD' o timestamps ISO
}
function fechaLarga(s) {
  const d = new Date(soloFecha(s) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(s || '');
  return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MES[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function Agenda() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const hoyStr = ymd(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [diaSel, setDiaSel] = useState(hoyStr);
  const [nueva, setNueva] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);
  async function cargar() {
    setCargando(true);
    try {
      const data = await api.citasList();
      // Normaliza la fecha SIEMPRE a YYYY-MM-DD (clave del calendario).
      setCitas((data || []).map((c) => ({ ...c, fecha: soloFecha(c.fecha), hora: String(c.hora || '').slice(0, 5) })));
    } catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }
  async function cambiarEstado(c, estado) {
    setCitas((xs) => xs.map((x) => x.id === c.id ? { ...x, estado } : x));
    try { await api.citaUpdate({ id: c.id, estado, nota: c.nota || '' }); }
    catch (err) { alert('Error: ' + err.message); cargar(); }
  }
  async function guardarNota(c, nota) {
    if ((c.nota || '') === (nota || '')) return;
    setCitas((xs) => xs.map((x) => x.id === c.id ? { ...x, nota } : x));
    try { await api.citaUpdate({ id: c.id, estado: c.estado, nota }); }
    catch (err) { alert('Error: ' + err.message); }
  }
  async function borrar(id) {
    if (!confirm('¿Borrar esta cita?')) return;
    try { await api.citaDelete(id); setCitas((xs) => xs.filter((x) => x.id !== id)); }
    catch (err) { alert('Error: ' + err.message); }
  }
  async function crearManual() {
    if (!nueva?.nombre?.trim()) { alert('Pon al menos un nombre.'); return; }
    setGuardando(true);
    try {
      await api.citaCrear({ nombre: nueva.nombre.trim(), email: (nueva.email || '').trim(), telefono: (nueva.telefono || '').trim(), fecha: nueva.fecha, hora: nueva.hora, nota: (nueva.nota || '').trim(), estado: 'confirmada' });
      setNueva(null); await cargar();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  }

  const visibles = useMemo(() => filtro === 'todas' ? citas : citas.filter((c) => c.estado === filtro), [citas, filtro]);
  const porDia = useMemo(() => {
    const m = {};
    for (const c of visibles) (m[c.fecha] = m[c.fecha] || []).push(c);
    for (const k in m) m[k].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    return m;
  }, [visibles]);

  const proximas = citas.filter((c) => c.fecha >= hoyStr && c.estado !== 'cancelada');
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const diasMes = new Date(year, month + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(new Date(year, month, d));
  while (celdas.length % 7 !== 0) celdas.push(null);

  const dSel = new Date(diaSel + 'T00:00:00');
  const finde = dSel.getDay() === 0 || dSel.getDay() === 6;
  const citasDia = (porDia[diaSel] || []);
  const citaEnHora = (h) => citasDia.find((c) => c.hora === h && c.estado !== 'cancelada');
  const extra = citasDia.filter((c) => !HORAS.includes(c.hora));

  const btn = { cursor: 'pointer', border: '1px solid #e3e8e5', background: '#fff', borderRadius: 10, padding: '8px 12px', fontWeight: 600 };

  return (
    <div>
      <h1>Agenda</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>Calendario de citas. Las reservas del Agente Nex y del formulario entran aquí automáticamente.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTROS.map((f) => {
          const activo = filtro === f.k;
          const n = f.k === 'todas' ? citas.length : citas.filter((c) => c.estado === f.k).length;
          return (
            <button key={f.k} onClick={() => setFiltro(f.k)} style={{
              cursor: 'pointer', borderRadius: 999, padding: '7px 14px', fontWeight: 700, fontSize: 13,
              border: activo ? '1px solid #16a34a' : '1px solid #e3e8e5',
              background: activo ? '#16a34a' : '#fff', color: activo ? '#fff' : '#475569',
            }}>{f.label} <span style={{ opacity: .8 }}>({n})</span></button>
          );
        })}
      </div>

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
                const items = porDia[s] || [];
                const esHoy = s === hoyStr, sel = s === diaSel;
                const wknd = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <button key={i} onClick={() => setDiaSel(s)} style={{
                    cursor: 'pointer', minHeight: 66, borderRadius: 10, padding: 6, textAlign: 'left',
                    border: sel ? '2px solid #16a34a' : '1px solid #eef2f0',
                    background: sel ? '#f0fdf4' : (wknd ? '#fafafa' : '#fff'),
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: esHoy ? '#16a34a' : '#1f2937' }}>{d.getDate()}{esHoy ? ' •' : ''}</div>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {items.slice(0, 3).map((c) => (
                        <span key={c.id} title={`${c.hora} · ${c.nombre || ''}${c.nota ? ' · ' + c.nota : ''}`} style={{ fontSize: 10, background: (EST[c.estado] || {}).color || '#999', color: '#fff', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>{c.hora}</span>
                      ))}
                      {items.length > 3 && <span style={{ fontSize: 10, color: '#67756c' }}>+{items.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16, textTransform: 'capitalize' }}>{fechaLarga(diaSel)}</h2>
        {finde ? (
          <p style={{ color: '#67756c' }}>Fin de semana — sin horario de atención. (L-V de 09:00 a 13:30 y de 16:00 a 19:00.)</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {HORAS.map((h) => {
              const c = citaEnHora(h);
              if (!c) {
                return (
                  <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', border: '1px dashed #e3e8e5', borderRadius: 10 }}>
                    <div style={{ minWidth: 54, fontWeight: 700, color: '#94a3b8' }}>{h}</div>
                    <div style={{ flex: 1, color: '#94a3b8' }}>Libre</div>
                    <button onClick={() => setNueva({ fecha: diaSel, hora: h, nombre: '', email: '', telefono: '', nota: '' })}
                      style={{ ...btn, padding: '5px 10px', fontSize: 13, color: '#16a34a', borderColor: '#bbf7d0' }}>+ Reservar</button>
                  </div>
                );
              }
              const e = EST[c.estado] || EST.pendiente;
              return (
                <div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px', border: `1px solid ${e.color}33`, background: e.bg, borderRadius: 10 }}>
                  <div style={{ minWidth: 54, fontWeight: 800, color: '#1f2937' }}>{h}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.nombre || c.prospecto_empresa || 'Sin nombre'}
                      {c.origen === 'agente' ? <span style={{ color: '#5b3fa0', fontSize: 11 }}> · Agente Nex</span> : c.origen === 'frio' ? <span style={{ color: '#16a34a', fontSize: 11 }}> · captación</span> : c.origen === 'manual' ? <span style={{ color: '#64748b', fontSize: 11 }}> · manual</span> : null}
                    </div>
                    <div style={{ fontSize: 13, color: '#67756c', margin: '2px 0' }}>{[c.email, c.telefono].filter(Boolean).join(' · ') || 'Sin contacto'}</div>
                    <input defaultValue={c.nota || ''} placeholder="Qué quiere el cliente / nota para preparar la reunión…" onBlur={(ev) => guardarNota(c, ev.target.value)}
                      style={{ width: '100%', maxWidth: 420, fontSize: 13, border: '1px solid #e3e8e5', borderRadius: 8, padding: '5px 8px', marginTop: 2 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <select value={c.estado} onChange={(ev) => cambiarEstado(c, ev.target.value)} style={{ color: e.color, fontWeight: 700, border: `1px solid ${e.color}55`, borderRadius: 8, padding: '4px 6px' }}>
                      {ORDEN_EST.map((s) => <option key={s} value={s}>{EST[s].label}</option>)}
                    </select>
                    <button onClick={() => borrar(c.id)} style={{ color: '#c0392b', fontSize: 12, border: 'none', background: 'none', cursor: 'pointer' }}>Borrar</button>
                  </div>
                </div>
              );
            })}
            {extra.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 12, padding: '10px', border: '1px solid #e3e8e5', borderRadius: 10 }}>
                <div style={{ minWidth: 54, fontWeight: 800 }}>{c.hora}</div>
                <div style={{ flex: 1 }}>{c.nombre} <span style={{ color: '#67756c', fontSize: 13 }}>{c.nota ? '· ' + c.nota : ''}</span></div>
                <button onClick={() => borrar(c.id)} style={{ color: '#c0392b', fontSize: 12, border: 'none', background: 'none', cursor: 'pointer' }}>Borrar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Próximas citas</h2>
        {proximas.length === 0 ? (
          <p style={{ color: '#67756c' }}>No hay citas próximas. Cuando reserven (Agente Nex, formulario o email), aparecerán aquí.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximas.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).slice(0, 40).map((c) => {
              const e = EST[c.estado] || EST.pendiente;
              return (
                <div key={c.id} onClick={() => { const [y, m] = c.fecha.split('-'); setCursor(new Date(+y, +m - 1, 1)); setDiaSel(c.fecha); }}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 10px', border: '1px solid #eef2f0', borderRadius: 10, cursor: 'pointer' }}>
                  <div style={{ minWidth: 98, fontWeight: 700 }}>{c.fecha.split('-').reverse().slice(0, 2).join('/')} · {c.hora}</div>
                  <div style={{ flex: 1 }}>{c.nombre || c.prospecto_empresa || '-'} <span style={{ color: '#67756c', fontSize: 13 }}>{c.nota ? '· ' + c.nota : ''}</span></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: e.color, borderRadius: 20, padding: '2px 10px' }}>{e.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {nueva && (
        <div onClick={() => setNueva(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Nueva cita — {nueva.hora} h</h3>
            <p style={{ color: '#67756c', marginTop: -8, fontSize: 13 }}>{fechaLarga(nueva.fecha)}</p>
            {['nombre', 'email', 'telefono', 'nota'].map((f) => (
              <input key={f} placeholder={f === 'nota' ? 'Qué quiere el cliente (opcional)' : f.charAt(0).toUpperCase() + f.slice(1) + (f === 'nombre' ? ' *' : ' (opcional)')}
                value={nueva[f]} onChange={(e) => setNueva({ ...nueva, [f]: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1px solid #e3e8e5', borderRadius: 10, marginBottom: 10, fontSize: 14 }} />
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setNueva(null)} style={{ ...btn }}>Cancelar</button>
              <button onClick={crearManual} disabled={guardando} style={{ ...btn, background: '#16a34a', color: '#fff', border: 'none' }}>{guardando ? 'Guardando…' : 'Reservar cita'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
