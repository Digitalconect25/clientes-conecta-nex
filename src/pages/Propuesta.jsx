import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', tealDark: '#0a5e53', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

export default function Propuesta() {
  const { token } = useParams();
  const [p, setP] = useState(null);
  const [estado, setEstado] = useState('cargando'); // cargando|ok|error
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState('');

  useEffect(() => {
    fetch('/api/propuesta?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setP(j); setEstado('ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  async function aceptar() {
    if (nombre.trim().length < 3) { setError('Escribe tu nombre y apellidos para aceptar.'); return; }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/propuesta?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aceptar', nombre: nombre.trim() }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setHecho('aceptada'); setP((x) => ({ ...x, estado: 'aceptada', acept_nombre: nombre.trim(), aceptada_en: new Date().toISOString() })); }
      else setError(j.error || 'No se pudo aceptar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 640, margin: '34px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, padding: 0, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando propuesta…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Propuesta no disponible</h2>
      <p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  const aceptada = p.estado === 'aceptada' || hecho === 'aceptada';
  const cerrada = ['aceptada', 'rechazada', 'caducada'].includes(p.estado);

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '26px 28px 16px', borderBottom: '1px solid #f2eee3' }}>
            <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, height: 'auto' }} />
          </div>
          <div style={{ padding: '26px 28px 30px' }}>
            <div style={{ color: C.tenue, fontSize: 13, letterSpacing: 1 }}>{p.numero}</div>
            <h1 style={{ margin: '4px 0 2px', fontSize: 24, color: C.ink }}>{p.titulo}</h1>
            <div style={{ height: 3, width: 44, background: C.teal, borderRadius: 3, margin: '12px 0 18px' }} />
            {p.destinatario_nombre && <p style={{ margin: '0 0 10px' }}>Hola {p.destinatario_nombre},</p>}
            {p.intro && <p style={{ margin: '0 0 16px', lineHeight: 1.65, color: C.cuerpo }}>{p.intro}</p>}

            {/* Diagnostico humanizado: problema -> solucion -> plazo */}
            {(p.problema || p.solucion || p.plazo) && (
              <div style={{ margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.problema && (
                  <div style={{ background: '#fff6ec', borderLeft: '4px solid #ea580c', borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#ea580c', fontSize: 13.5, marginBottom: 2 }}>Lo que vemos</div>
                    <div style={{ color: C.cuerpo, lineHeight: 1.6 }}>{p.problema}</div>
                  </div>
                )}
                {p.solucion && (
                  <div style={{ background: '#eef8f5', borderLeft: '4px solid ' + C.teal, borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: C.tealDark, fontSize: 13.5, marginBottom: 2 }}>Cómo lo resolvemos</div>
                    <div style={{ color: C.cuerpo, lineHeight: 1.6 }}>{p.solucion}</div>
                  </div>
                )}
                {p.plazo && (
                  <div style={{ background: '#f3f0fa', borderLeft: '4px solid #5b3fa0', borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#5b3fa0', fontSize: 13.5, marginBottom: 2 }}>En cuánto tiempo</div>
                    <div style={{ color: C.cuerpo, lineHeight: 1.6 }}>{p.plazo}</div>
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            <div style={{ border: '1px solid ' + C.linea, borderRadius: 12, overflow: 'hidden' }}>
              {(p.items || []).map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderTop: i ? '1px solid ' + C.linea : 'none', background: i % 2 ? '#fbfaf6' : '#fff' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.nombre}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}</div>
                    {it.descripcion && <div style={{ color: C.tenue, fontSize: 13, marginTop: 2 }}>{it.descripcion}</div>}
                  </div>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{eur(it.subtotal != null ? it.subtotal : it.precio * (it.cantidad || 1))}</div>
                </div>
              ))}
              {Number(p.descuento) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid ' + C.linea, color: C.tealDark }}>
                  <div>Descuento</div><div>− {eur(p.descuento)}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid ' + C.linea, color: C.tenue, fontSize: 14 }}>
                <div>Base imponible</div><div>{eur(p.total)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', color: C.tenue, fontSize: 14 }}>
                <div>IVA (21%)</div><div>{eur(Number(p.total) * 0.21)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderTop: '2px solid ' + C.linea, background: C.crema, fontWeight: 800, fontSize: 17 }}>
                <div>Total (IVA incl.)</div><div>{eur(Number(p.total) * 1.21)}</div>
              </div>
            </div>

            {p.notas && <p style={{ marginTop: 16, color: C.tenue, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.notas}</p>}
            <p style={{ marginTop: 10, color: C.tenue, fontSize: 13 }}>Validez de la propuesta: {p.validez_dias} días.</p>

            {/* Aceptación */}
            {!cerrada && (
              <div style={{ marginTop: 22, background: C.crema, border: '1px solid ' + C.linea, borderRadius: 12, padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>¿Te encaja? Acéptala aquí</div>
                <p style={{ margin: '0 0 10px', color: C.tenue, fontSize: 13.5 }}>Escribe tu nombre y apellidos. Al aceptar quedará registrada con fecha y hora.</p>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, boxSizing: 'border-box' }} />
                {error && <p style={{ color: '#c0392b', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
                <button onClick={aceptar} disabled={enviando}
                  style={{ marginTop: 12, width: '100%', padding: '14px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: enviando ? 0.7 : 1 }}>
                  {enviando ? 'Registrando…' : 'Aceptar la propuesta'}
                </button>
              </div>
            )}
            {aceptada && (
              <div style={{ marginTop: 22, background: '#eef8f3', border: '1px solid #cfe9d8', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Propuesta aceptada</div>
                <p style={{ color: C.cuerpo, margin: '6px 0 0' }}>Gracias{p.acept_nombre ? ', ' + p.acept_nombre : ''}. Lo tenemos registrado y te contactamos enseguida para arrancar.</p>
              </div>
            )}
            {p.estado === 'rechazada' && !aceptada && <p style={{ marginTop: 20, color: C.tenue, textAlign: 'center' }}>Esta propuesta se marcó como no aceptada. Si cambias de idea, escríbenos.</p>}
            {p.estado === 'caducada' && <p style={{ marginTop: 20, color: C.tenue, textAlign: 'center' }}>Esta propuesta ha caducado. Escríbenos y te preparamos una actualizada.</p>}
          </div>
          <div style={{ padding: '16px 28px 22px', borderTop: '1px solid #f2eee3', color: '#9a9384', fontSize: 12, textAlign: 'center' }}>
            Conecta NEX · Calle Alberola 24, 03007 Alicante · <a href="https://conectanex.es" target="_blank" rel="noopener noreferrer" style={{ color: C.teal, textDecoration: 'none' }}>conectanex.es</a>
          </div>
        </div>
      </div>
    </div>
  );
}
