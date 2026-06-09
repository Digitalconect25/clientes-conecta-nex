import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Bandeja() {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);

  // Carga inicial + auto-refresco cada 15s (silencioso) para que entren los emails solos.
  useEffect(() => {
    cargar();
    const t = setInterval(() => cargar(true), 15000);
    return () => clearInterval(t);
  }, []);
  async function cargar(silencioso) {
    if (!silencioso) setCargando(true);
    try { const r = await api.mensajesList(); setMensajes(r.mensajes || []); }
    catch (err) { if (!silencioso) alert('Error: ' + err.message); }
    finally { if (!silencioso) setCargando(false); }
  }
  async function abrir(m) {
    setAbierto(abierto === m.id ? null : m.id);
    if (!m.leido) { try { await api.mensajeLeido(m.id, true); setMensajes((xs) => xs.map((x) => x.id === m.id ? { ...x, leido: true } : x)); } catch {} }
  }
  async function borrar(id) {
    if (!confirm('Borrar este mensaje?')) return;
    try { await api.mensajeDelete(id); setMensajes((xs) => xs.filter((x) => x.id !== id)); }
    catch (err) { alert('Error: ' + err.message); }
  }

  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };
  const noLeidos = mensajes.filter((m) => !m.leido).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Bandeja de entrada {noLeidos ? <span style={{ fontSize: 14, color: '#fff', background: '#16a34a', borderRadius: 999, padding: '2px 10px', verticalAlign: 'middle' }}>{noLeidos} sin leer</span> : null}</h1>
        <button onClick={() => cargar(false)}>Actualizar</button>
      </div>
      <p style={{ color: '#67756c', marginTop: 4 }}>Respuestas que llegan a tus emails de captacion (se actualiza sola cada 15s). Si una respuesta es de un prospecto, este pasa a "respondio" automaticamente.</p>

      {cargando ? <p>Cargando...</p> : !mensajes.length ? (
        <div style={card}>
          <p style={{ margin: 0, color: '#67756c' }}>Aun no hay mensajes. Cuando un cliente responda a tus emails (o escriba a tu dominio), su mensaje aparecera aqui automaticamente.</p>
        </div>
      ) : mensajes.map((m) => (
        <div key={m.id} style={{ ...card, marginBottom: 10, borderLeft: m.leido ? '1px solid #e3e8e5' : '3px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }} onClick={() => abrir(m)}>
            <div>
              <b style={{ fontWeight: m.leido ? 500 : 700 }}>{m.de || '(sin remitente)'}</b>
              {m.prospecto_empresa ? <span style={{ color: '#16a34a', fontSize: 12 }}> · {m.prospecto_empresa}</span> : null}
              {m.cliente_nombre ? <span style={{ color: '#2563eb', fontSize: 12 }}> · cliente: {m.cliente_nombre}</span> : null}
              <div style={{ fontSize: 14, color: '#1f2a24' }}>{m.asunto || '(sin asunto)'}</div>
              <div style={{ fontSize: 13, color: '#67756c', maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(m.texto || '').slice(0, 120)}</div>
            </div>
            <div style={{ fontSize: 12, color: '#9aa6a0', whiteSpace: 'nowrap' }}>{new Date(m.recibido_en).toLocaleString('es-ES')}</div>
          </div>
          {abierto === m.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid #eef2f0', paddingTop: 12 }}>
              {m.html ? <div style={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: m.html }} /> : <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{m.texto || '(sin contenido)'}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {m.de && <a className="btn-primary btn-sm" href={'mailto:' + (m.de.match(/[^\s<>]+@[^\s<>]+/) || [''])[0] + '?subject=RE: ' + encodeURIComponent(m.asunto || '')} style={{ textDecoration: 'none', padding: '7px 12px', background: '#16a34a', color: '#fff', borderRadius: 8 }}>Responder</a>}
                <button onClick={() => borrar(m.id)} style={{ color: '#c0392b', padding: '7px 12px' }}>Borrar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
