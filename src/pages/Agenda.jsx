import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

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
const ORIGEN = { agente: 'Agente Nex (web)', frio: 'Captación / formulario', cliente: 'Cliente', manual: 'Alta manual' };
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
function soloFecha(s) { return String(s || '').slice(0, 10); }
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
  const [detalle, setDetalle] = useState(null);
  const [notaEdit, setNotaEdit] = useState('');
  const [notaInt, setNotaInt] = useState('');
  const [repro, setRepro] = useState(null);  // { fecha, hora }
  const [mail, setMail] = useState(null);     // { asunto, mensaje, enviando }

  useEffect(() => { cargar(); }, []);
  async function cargar() {
    setCargando(true);
    try {
      const data = await api.citasList();
      setCitas((data || []).map((c) => ({ ...c, fecha: soloFecha(c.fecha), hora: String(c.hora || '').slice(0, 5) })));
    } catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }
  function abrirFicha(c) { setDetalle(c); setNotaEdit(c.nota || ''); setNotaInt(c.nota_interna || ''); setRepro(null); setMail(null); }
  async function cambiarEstado(c, estado) {
    setCitas((xs) => xs.map((x) => x.id === c.id ? { ...x, estado } : x));
    setDetalle((d) => d && d.id === c.id ? { ...d, estado } : d);
    try { await api.citaUpdate({ id: c.id, estado, nota: c.nota || '' }); }
    catch (err) { alert('Error: ' + err.message); cargar(); }
  }
  async function guardarNota(c, nota) {
    if ((c.nota || '') === (nota || '')) return;
    setCitas((xs) => xs.map((x) => x.id === c.id ? { ...x, nota } : x));
    setDetalle((d) => d && d.id === c.id ? { ...d, nota } : d);
    try { await api.citaUpdate({ id: c.id, nota }); }
    catch (err) { alert('Error: ' + err.message); }
  }
  async function guardarNotaInterna() {
    try {
      await api.citaUpdate({ id: detalle.id, nota_interna: notaInt });
      setCitas((xs) => xs.map((x) => x.id === detalle.id ? { ...x, nota_interna: notaInt } : x));
      setDetalle((d) => ({ ...d, nota_interna: notaInt }));
      alert('Nota interna guardada ✓');
    } catch (err) { alert('Error: ' + err.message); }
  }
  async function reprogramar() {
    if (!repro?.fecha || !repro?.hora) { alert('Elige el nuevo día y hora.'); return; }
    try {
      await api.citaUpdate({ id: detalle.id, fecha: repro.fecha, hora: repro.hora });
      // Avisar al cliente del cambio por email (si tiene email y no se desmarcó)
      const avisado = repro.avisar !== false && !!detalle.email;
      if (avisado) {
        const cuando = fechaLarga(repro.fecha) + ' a las ' + repro.hora + ' h';
        const html = `<p>Hola ${detalle.nombre || ''},</p>`
          + `<p>Te escribimos para avisarte de que tu cita con Conecta NEX se ha <b>cambiado de fecha</b>.</p>`
          + `<p><b>Nueva cita:</b> ${cuando}${detalle.modalidad ? ' (' + detalle.modalidad + ')' : ''}.</p>`
          + `<p>Si esta nueva fecha no te viene bien, responde a este correo y buscamos otro hueco. ¡Gracias!</p>`;
        try { await api.emailEnviar({ destinatario: detalle.email, asunto: 'Tu cita con Conecta NEX se ha cambiado de fecha', cuerpo_html: html }); } catch { /* no bloquea el cambio */ }
      }
      setDetalle((d) => ({ ...d, fecha: repro.fecha, hora: repro.hora }));
      setRepro(null); await cargar();
      alert('Cita reprogramada ✓' + (avisado ? ' — cliente avisado por email' : ''));
    } catch (err) { alert('Error: ' + err.message); }
  }
  // Plantillas de email listas para usar en la ficha de cita
  function plantillaMail(tipo) {
    const nombre = detalle?.nombre || '';
    const cuando = detalle ? (fechaLarga(detalle.fecha) + ' a las ' + detalle.hora + ' h') : '';
    const firma = '\n\nUn saludo,\nEquipo Conecta NEX';
    const T = {
      confirmar: {
        asunto: 'Confirmación de tu cita con Conecta NEX',
        mensaje: `Hola ${nombre},\n\nTe confirmamos tu cita para el ${cuando}. Si necesitas cambiarla, responde a este correo y lo ajustamos.${firma}`,
      },
      recordatorio: {
        asunto: 'Recordatorio de tu cita con Conecta NEX',
        mensaje: `Hola ${nombre},\n\nSolo un recordatorio de tu cita: ${cuando}. Si te surge cualquier cosa, escríbenos. ¡Te esperamos!${firma}`,
      },
      seguimiento: {
        asunto: 'Seguimiento — Conecta NEX',
        mensaje: `Hola ${nombre},\n\nUn placer hablar contigo. ¿Pudiste valorar lo que comentamos? Quedamos a tu disposición para dar el siguiente paso cuando quieras.${firma}`,
      },
      gracias: {
        asunto: 'Gracias por tu tiempo — Conecta NEX',
        mensaje: `Hola ${nombre},\n\nGracias por atendernos. Te enviaremos un resumen de la propuesta. Cualquier duda, aquí estamos.${firma}`,
      },
    };
    const t = T[tipo] || T.confirmar;
    setMail({ asunto: t.asunto, mensaje: t.mensaje, enviando: false });
  }
  async function enviarMail() {
    if (!detalle.email) { alert('Esta cita no tiene email.'); return; }
    if (!mail?.asunto?.trim() || !mail?.mensaje?.trim()) { alert('Pon asunto y mensaje.'); return; }
    setMail((m) => ({ ...m, enviando: true }));
    try {
      const html = mail.mensaje.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
      await api.emailEnviar({ destinatario: detalle.email, asunto: mail.asunto.trim(), cuerpo_html: html });
      setMail(null); alert('Email enviado ✓');
    } catch (err) { alert('Error: ' + err.message); setMail((m) => ({ ...m, enviando: false })); }
  }
  async function borrar(id) {
    if (!confirm('¿Borrar esta cita?')) return;
    try { await api.citaDelete(id); setCitas((xs) => xs.filter((x) => x.id !== id)); setDetalle(null); }
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
      <p style={{ color: '#67756c', marginTop: -6 }}>Calendario de citas. Pulsa una cita para ver toda su información. Las reservas del Agente Nex y del formulario entran aquí automáticamente.</p>

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
                <button key={h} onClick={() => abrirFicha(c)} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '10px', border: `1px solid ${e.color}33`, background: e.bg, borderRadius: 10 }}>
                  <div style={{ minWidth: 54, fontWeight: 800, color: '#1f2937' }}>{c.hora}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.nombre || c.prospecto_empresa || 'Sin nombre'}</div>
                    <div style={{ fontSize: 13, color: '#67756c', marginTop: 2 }}>{c.nota || [c.email, c.telefono].filter(Boolean).join(' · ') || 'Sin nota'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.color, border: `1px solid ${e.color}55`, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{e.label}</span>
                </button>
              );
            })}
            {extra.map((c) => (
              <button key={c.id} onClick={() => abrirFicha(c)} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, padding: '10px', border: '1px solid #e3e8e5', borderRadius: 10 }}>
                <div style={{ minWidth: 54, fontWeight: 800 }}>{c.hora}</div>
                <div style={{ flex: 1 }}>{c.nombre} <span style={{ color: '#67756c', fontSize: 13 }}>{c.nota ? '· ' + c.nota : ''}</span></div>
              </button>
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
                <button key={c.id} onClick={() => abrirFicha(c)}
                  style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', padding: '8px 10px', border: '1px solid #eef2f0', borderRadius: 10, background: '#fff' }}>
                  <div style={{ minWidth: 98, fontWeight: 700 }}>{c.fecha.split('-').reverse().slice(0, 2).join('/')} · {c.hora}</div>
                  <div style={{ flex: 1 }}>{c.nombre || c.prospecto_empresa || '-'} <span style={{ color: '#67756c', fontSize: 13 }}>{c.nota ? '· ' + c.nota : ''}</span></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: e.color, borderRadius: 20, padding: '2px 10px' }}>{e.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ficha de cita */}
      {detalle && (() => {
        const e = EST[detalle.estado] || EST.pendiente;
        const row = { display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f0', fontSize: 14 };
        const lab = { minWidth: 92, color: '#8a8276', fontSize: 13 };
        const inp = { width: '100%', border: '1px solid #e3e8e5', borderRadius: 10, padding: 10, fontSize: 14 };
        return (
          <div onClick={() => setDetalle(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div onClick={(ev) => ev.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ background: e.color, color: '#fff', padding: '18px 22px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{detalle.nombre || detalle.prospecto_empresa || 'Cita'}</div>
                  <div style={{ opacity: .9, fontSize: 13, marginTop: 2 }}>{e.label}</div>
                </div>
                <button onClick={() => setDetalle(null)} style={{ background: 'transparent', border: 0, color: '#fff', fontSize: 22, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: 22 }}>
                <div style={row}><span style={lab}>Día</span><b style={{ textTransform: 'capitalize' }}>{fechaLarga(detalle.fecha)}</b></div>
                <div style={row}><span style={lab}>Hora</span><b>{detalle.hora} h</b></div>
                <div style={row}><span style={lab}>Email</span>{detalle.email ? <a href={`mailto:${detalle.email}`}>{detalle.email}</a> : <span style={{ color: '#b9b1a3' }}>—</span>}</div>
                <div style={row}><span style={lab}>Teléfono</span>{detalle.telefono ? <a href={`tel:${detalle.telefono}`}>{detalle.telefono}</a> : <span style={{ color: '#b9b1a3' }}>—</span>}</div>
                {detalle.prospecto_empresa && <div style={row}><span style={lab}>Empresa</span><span>{detalle.prospecto_empresa}</span></div>}
                <div style={row}><span style={lab}>Origen</span><span>{ORIGEN[detalle.origen] || detalle.origen || '—'}</span></div>
                {detalle.creado_en && <div style={row}><span style={lab}>Creada</span><span>{soloFecha(detalle.creado_en).split('-').reverse().join('/')}</span></div>}

                <div style={{ marginTop: 14 }}>
                  <div style={{ ...lab, marginBottom: 6 }}>Qué quiere el cliente (para preparar la reunión)</div>
                  <textarea value={notaEdit} onChange={(ev) => setNotaEdit(ev.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
                  <button onClick={() => guardarNota(detalle, notaEdit)} style={{ ...btn, marginTop: 8, fontSize: 13, padding: '6px 12px' }}>Guardar</button>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ ...lab, marginBottom: 6 }}>Notas internas del equipo (privadas)</div>
                  <textarea value={notaInt} onChange={(ev) => setNotaInt(ev.target.value)} rows={3} placeholder="Solo para el equipo: contexto, preparación, seguimiento…" style={{ ...inp, resize: 'vertical', background: '#fbfaf7' }} />
                  <button onClick={guardarNotaInterna} style={{ ...btn, marginTop: 8, fontSize: 13, padding: '6px 12px' }}>Guardar nota interna</button>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={lab}>Estado</span>
                  <select value={detalle.estado} onChange={(ev) => cambiarEstado(detalle, ev.target.value)} style={{ color: e.color, fontWeight: 700, border: `1px solid ${e.color}55`, borderRadius: 8, padding: '6px 8px' }}>
                    {ORDEN_EST.map((s) => <option key={s} value={s}>{EST[s].label}</option>)}
                  </select>
                </div>

                {/* Reprogramar */}
                <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f0', paddingTop: 14 }}>
                  {!repro ? (
                    <button onClick={() => setRepro({ fecha: detalle.fecha, hora: detalle.hora, avisar: true })} style={{ ...btn, fontSize: 13, padding: '7px 12px' }}>🗓️ Reprogramar cita</button>
                  ) : (
                    <div>
                      <div style={{ ...lab, marginBottom: 6 }}>Nuevo día y hora</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input type="date" min={hoyStr} value={repro.fecha} onChange={(ev) => setRepro({ ...repro, fecha: ev.target.value })} style={{ ...inp, width: 'auto' }} />
                        <select value={repro.hora} onChange={(ev) => setRepro({ ...repro, hora: ev.target.value })} style={{ ...inp, width: 'auto' }}>
                          {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      {detalle.email && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#475569' }}>
                          <input type="checkbox" checked={repro.avisar !== false} onChange={(ev) => setRepro({ ...repro, avisar: ev.target.checked })} />
                          Avisar al cliente por email del cambio
                        </label>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={reprogramar} style={{ ...btn, background: '#16a34a', color: '#fff', border: 'none', fontSize: 13, padding: '7px 12px' }}>Mover cita</button>
                        <button onClick={() => setRepro(null)} style={{ ...btn, fontSize: 13, padding: '7px 12px' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enviar email */}
                {detalle.email && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f0', paddingTop: 14 }}>
                    {!mail ? (
                      <button onClick={() => plantillaMail('confirmar')} style={{ ...btn, fontSize: 13, padding: '7px 12px' }}>✉️ Enviar email al cliente</button>
                    ) : (
                      <div>
                        <div style={{ ...lab, marginBottom: 6 }}>Email a {detalle.email}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {[['confirmar', 'Confirmar cita'], ['recordatorio', 'Recordatorio'], ['seguimiento', 'Seguimiento'], ['gracias', 'Gracias']].map(([k, t]) => (
                            <button key={k} onClick={() => plantillaMail(k)} style={{ ...btn, fontSize: 12, padding: '4px 10px' }}>{t}</button>
                          ))}
                        </div>
                        <input value={mail.asunto} onChange={(ev) => setMail({ ...mail, asunto: ev.target.value })} placeholder="Asunto" style={{ ...inp, marginBottom: 8 }} />
                        <textarea value={mail.mensaje} onChange={(ev) => setMail({ ...mail, mensaje: ev.target.value })} rows={7} placeholder="Mensaje" style={{ ...inp, resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={enviarMail} disabled={mail.enviando} style={{ ...btn, background: '#5b3fa0', color: '#fff', border: 'none', fontSize: 13, padding: '7px 12px' }}>{mail.enviando ? 'Enviando…' : 'Enviar email'}</button>
                          <button onClick={() => setMail(null)} style={{ ...btn, fontSize: 13, padding: '7px 12px' }}>Cancelar</button>
                        </div>
                        <p style={{ fontSize: 11, color: '#9aa6a0', marginTop: 6 }}>Elige una plantilla arriba o escribe tu propio mensaje. Se envía con la firma y el diseño de Conecta NEX.</p>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 18, textAlign: 'right' }}>
                  <button onClick={() => borrar(detalle.id)} style={{ color: '#c0392b', border: '1px solid #f3c0b8', background: '#fff', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>Borrar cita</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Alta manual */}
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
