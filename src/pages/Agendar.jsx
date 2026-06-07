import { useEffect, useState } from 'react';

// Pagina PUBLICA: el prospecto/cliente reserva una cita desde el email.
// No requiere login. Lee ?p=<prospecto_id> de la URL para enlazar la cita.
export default function Agendar() {
  const params = new URLSearchParams(window.location.search);
  const p = params.get('p') || '';
  const [fecha, setFecha] = useState('');
  const [slots, setSlots] = useState([]);
  const [hora, setHora] = useState('');
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [datos, setDatos] = useState({ nombre: '', email: '', telefono: '', nota: '' });
  const [hp, setHp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState('');

  const hoy = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!fecha) { setSlots([]); setHora(''); return; }
    setCargandoSlots(true); setHora('');
    fetch('/api/agendar?fecha=' + fecha)
      .then((r) => r.json())
      .then((j) => setSlots(j.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setCargandoSlots(false));
  }, [fecha]);

  async function reservar() {
    setError('');
    if (!fecha || !hora) { setError('Elige dia y hora.'); return; }
    if (!datos.nombre.trim()) { setError('Pon tu nombre.'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p, fecha, hora, website2: hp, ...datos }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true);
      else { setError(j.error || 'No se pudo reservar.'); if (r.status === 409) { fetch('/api/agendar?fecha=' + fecha).then((x) => x.json()).then((x) => setSlots(x.slots || [])); } }
    } catch { setError('No se pudo conectar. Intentalo de nuevo.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 520, margin: '40px auto', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#0f1c16' };
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 16, padding: 24, boxShadow: '0 6px 24px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, marginTop: 4 };

  if (hecho) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#eaf6ee', color: '#0f7a39', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: '6px 0' }}>Cita reservada</h2>
          <p style={{ color: '#67756c' }}>Te esperamos el <b>{fecha}</b> a las <b>{hora}</b>. Te lo confirmaremos en breve. Gracias.</p>
          <img src="/banner-email.png" alt="Conecta Nex" style={{ display: 'block', margin: '18px auto 0', maxWidth: '100%', height: 'auto', borderRadius: 10 }} />
          <button onClick={() => { try { window.close(); } catch (_) {} window.location.href = 'https://conectanex.com'; }} style={{ marginTop: 16, padding: '11px 22px', borderRadius: 10, border: '1px solid #d7ddd9', background: '#fff', color: '#0f1c16', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Cerrar y salir</button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Conecta <span style={{ color: '#16a34a' }}>Nex</span></div>
        <div style={{ color: '#67756c', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Digital Conect</div>
      </div>
      <input value={hp} onChange={(e) => setHp(e.target.value)} name="website2" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Agenda una llamada</h2>
        <p style={{ color: '#67756c', marginTop: -6 }}>Elige el dia y la hora que mejor te venga. Es una llamada breve, sin compromiso.</p>

        <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 600 }}>Dia
          <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} style={field} />
        </label>

        {fecha && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Hora</div>
            {cargandoSlots ? <p style={{ color: '#67756c' }}>Cargando horas...</p>
              : slots.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {slots.map((h) => (
                    <button key={h} onClick={() => setHora(h)} type="button"
                      style={{ padding: '9px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (hora === h ? '#16a34a' : '#d7ddd9'), background: hora === h ? '#16a34a' : '#fff', color: hora === h ? '#fff' : '#0f1c16', fontWeight: 600 }}>{h}</button>
                  ))}
                </div>
              ) : <p style={{ color: '#67756c' }}>No hay horas libres ese dia. Prueba con otro.</p>}
          </div>
        )}

        {hora && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>Tu nombre *
              <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} style={field} placeholder="Nombre y negocio" />
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 10 }}>Email
              <input type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} style={field} placeholder="tucorreo@ejemplo.com" />
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 10 }}>Telefono
              <input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} style={field} placeholder="+34 ..." />
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 10 }}>Algo que quieras comentar (opcional)
              <textarea value={datos.nota} onChange={(e) => setDatos({ ...datos, nota: e.target.value })} style={{ ...field, minHeight: 70 }} />
            </label>
            {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
            <button onClick={reservar} disabled={enviando} style={{ marginTop: 12, width: '100%', padding: '13px', borderRadius: 10, border: 0, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {enviando ? 'Reservando...' : 'Reservar mi cita'}
            </button>
          </div>
        )}
        {!hora && error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}
