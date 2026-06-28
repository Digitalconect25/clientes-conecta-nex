import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import FirmaCanvas from '../components/FirmaCanvas.jsx';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', linea: '#ece7da', fondo: '#f1efe8' };

export default function FirmaEmpresa() {
  const { token } = useParams();
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [firma, setFirma] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    fetch('/api/firma-empresa?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setInfo(j); setEstado('ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  async function guardar() {
    if (!firma) { setError('Dibuja tu firma en el recuadro.'); return; }
    setError(''); setGuardando(true);
    try {
      const r = await fetch('/api/firma-empresa?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firma }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true); else setError(j.error || 'No se pudo guardar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setGuardando(false); }
  }

  const wrap = { maxWidth: 520, margin: '28px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Enlace no disponible</h2><p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '22px 24px 12px', borderBottom: '1px solid #f2eee3' }}>
            <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 140, height: 'auto' }} />
          </div>
          <div style={{ padding: '22px 24px 26px' }}>
            {hecho ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 10 }}>✓</div>
                <h2 style={{ margin: '0 0 6px' }}>Firma guardada</h2>
                <p style={{ color: C.cuerpo }}>Tu firma quedará incrustada como Prestador en los contratos. Ya puedes cerrar esta página.</p>
              </div>
            ) : (
              <>
                <h1 style={{ margin: '0 0 2px', fontSize: 21 }}>Tu firma de empresa</h1>
                <div style={{ height: 3, width: 44, background: C.teal, borderRadius: 3, margin: '10px 0 14px' }} />
                <p style={{ color: C.cuerpo, margin: '0 0 12px' }}>Firma con el dedo en el recuadro. Se incrustará como tu firma (Prestador) en los contratos.</p>
                {info?.firma && (
                  <div style={{ marginBottom: 12, fontSize: 12.5, color: C.tenue }}>Firma actual guardada:
                    <img src={info.firma} alt="firma actual" style={{ display: 'block', maxHeight: 60, marginTop: 4, border: '1px solid ' + C.linea, borderRadius: 6 }} />
                    <span>Vuelve a firmar abajo para reemplazarla.</span>
                  </div>
                )}
                <div style={{ background: '#fff', border: '1px solid #d7ddd9', borderRadius: 10, padding: 6 }}>
                  <FirmaCanvas onChange={setFirma} />
                </div>
                {error && <p style={{ color: '#c0392b', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
                <button onClick={guardar} disabled={guardando}
                  style={{ marginTop: 14, width: '100%', padding: '15px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando…' : 'Guardar mi firma'}
                </button>
              </>
            )}
          </div>
          <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f2eee3', color: '#9a9384', fontSize: 12, textAlign: 'center' }}>Conecta NEX</div>
        </div>
      </div>
    </div>
  );
}
