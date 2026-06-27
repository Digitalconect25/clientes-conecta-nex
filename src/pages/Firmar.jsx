import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

export default function Firmar() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    fetch('/api/firmar?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setDoc(j); setEstado('ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  async function firmar() {
    if (nombre.trim().length < 3) { setError('Escribe tu nombre y apellidos.'); return; }
    if (!acepto) { setError('Marca la casilla de que has leído y aceptas el documento.'); return; }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/firmar?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'firmar', nombre: nombre.trim(), acepto: true }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true);
      else setError(j.error || 'No se pudo firmar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 760, margin: '30px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando documento…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Documento no disponible</h2>
      <p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  const yaFirmado = doc.firmado || hecho;

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '24px 28px 14px', borderBottom: '1px solid #f2eee3' }}>
            <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, height: 'auto' }} />
          </div>
          <div style={{ padding: '24px 28px 28px' }}>
            <h1 style={{ margin: '0 0 2px', fontSize: 22 }}>{doc.nombre}</h1>
            <div style={{ height: 3, width: 44, background: C.teal, borderRadius: 3, margin: '10px 0 16px' }} />
            {doc.cliente_nombre && <p style={{ margin: '0 0 12px', color: C.cuerpo }}>Para: <b>{doc.cliente_nombre}</b></p>}

            {/* Documento */}
            <div style={{ border: '1px solid ' + C.linea, borderRadius: 12, padding: 16, maxHeight: 460, overflow: 'auto', background: '#fff' }}>
              <div dangerouslySetInnerHTML={{ __html: doc.contenido_html || '<p>(Documento sin contenido)</p>' }} />
            </div>

            {hecho || doc.firmado ? (
              <div style={{ marginTop: 22, background: '#eef8f3', border: '1px solid #cfe9d8', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Documento firmado</div>
                <p style={{ color: C.cuerpo, margin: '6px 0 0' }}>Gracias{doc.firmante_nombre ? ', ' + doc.firmante_nombre : (nombre ? ', ' + nombre : '')}. Tu firma ha quedado registrada con fecha y hora. Te enviamos un justificante por email.</p>
              </div>
            ) : doc.firma_estado === 'rechazado' ? (
              <p style={{ marginTop: 20, color: C.tenue, textAlign: 'center' }}>Este documento se marcó como no aceptado. Si fue un error, escríbenos.</p>
            ) : (
              <div style={{ marginTop: 22, background: C.crema, border: '1px solid ' + C.linea, borderRadius: 12, padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Firmar el documento</div>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, boxSizing: 'border-box' }} />
                <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 12, fontSize: 14, color: C.cuerpo, cursor: 'pointer' }}>
                  <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>He leído y <b>acepto</b> el contenido de este documento. Entiendo que mi firma queda registrada con fecha, hora y dirección IP.</span>
                </label>
                {error && <p style={{ color: '#c0392b', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
                <button onClick={firmar} disabled={enviando || !acepto || nombre.trim().length < 3}
                  style={{ marginTop: 14, width: '100%', padding: '14px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (enviando || !acepto || nombre.trim().length < 3) ? 0.6 : 1 }}>
                  {enviando ? 'Registrando firma…' : 'Firmar'}
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: '16px 28px 22px', borderTop: '1px solid #f2eee3', color: '#9a9384', fontSize: 12, textAlign: 'center' }}>
            Conecta NEX · Calle Alberola 24, 03007 Alicante · <a href="https://conectanex.es" target="_blank" rel="noopener noreferrer" style={{ color: C.teal, textDecoration: 'none' }}>conectanex.es</a>
          </div>
        </div>
      </div>
    </div>
  );
}
