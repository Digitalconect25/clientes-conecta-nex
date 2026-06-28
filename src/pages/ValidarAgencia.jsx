import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

export default function ValidarAgencia() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    fetch('/api/validar?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setD(j); setEstado(j.validado ? 'validado' : 'ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  async function validar() {
    if (codigo.trim().length < 4) { setError('Introduce el código que te llegó por email.'); return; }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/validar?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: codigo.trim() }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true); else setError(j.error || 'No se pudo validar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 520, margin: '40px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 18, boxSizing: 'border-box', letterSpacing: 6, fontWeight: 700, textAlign: 'center' };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Enlace no disponible</h2><p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  const ya = hecho || estado === 'validado';

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '24px 28px 14px', borderBottom: '1px solid #f2eee3' }}>
            <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, height: 'auto' }} />
          </div>
          <div style={{ padding: '26px 28px 28px', textAlign: 'center' }}>
            {ya ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 10 }}>✓</div>
                <h2 style={{ margin: '0 0 6px' }}>Contrato validado</h2>
                <p style={{ color: C.cuerpo }}>El contrato queda firmado y validado por ambas partes. El encargo de <b>{d.cliente_nombre}</b> queda <b>iniciado</b>.</p>
              </>
            ) : (
              <>
                <h2 style={{ margin: '0 0 4px' }}>Valida el contrato</h2>
                <div style={{ height: 3, width: 44, background: C.teal, borderRadius: 3, margin: '10px auto 16px' }} />
                <p style={{ color: C.cuerpo, margin: '0 0 8px' }}><b>{d.firmante_nombre || d.cliente_nombre}</b> ha firmado <b>{d.nombre}</b>.</p>
                <p style={{ color: C.tenue, fontSize: 13.5, margin: '0 0 16px' }}>Introduce el código que te enviamos por email para validarlo como empresa y dar por iniciado el encargo.</p>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos" style={field} />
                {error && <p style={{ color: '#c0392b', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
                <button onClick={validar} disabled={enviando}
                  style={{ marginTop: 16, width: '100%', padding: '15px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
                  {enviando ? 'Validando…' : '✔ Validar e iniciar el encargo'}
                </button>
                {d.firma_ref && <p style={{ color: '#9aa6a0', fontSize: 11.5, marginTop: 12 }}>Nº de validación de la firma del cliente: {d.firma_ref}</p>}
              </>
            )}
          </div>
          <div style={{ padding: '16px 28px 22px', borderTop: '1px solid #f2eee3', color: '#9a9384', fontSize: 12, textAlign: 'center' }}>
            Conecta NEX · Calle Alberola 24, 03007 Alicante
          </div>
        </div>
      </div>
    </div>
  );
}
