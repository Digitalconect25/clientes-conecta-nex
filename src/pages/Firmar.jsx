import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import FirmaCanvas from '../components/FirmaCanvas.jsx';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

export default function Firmar() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [firmaImg, setFirmaImg] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [emailMask, setEmailMask] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Genera el PDF del documento firmado (en el navegador), lo guarda en el CRM y permite descargarlo.
  async function hacerPDF(html) {
    if (!html) return;
    setGenerandoPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      el.style.width = '794px'; el.innerHTML = html;
      const opt = { margin: [10, 8, 10, 8], html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
      const blob = await html2pdf().set(opt).from(el).output('blob');
      setPdfUrl(URL.createObjectURL(blob));
      const b64 = await new Promise((res2) => { const r = new FileReader(); r.onload = () => res2(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
      fetch('/api/firmar?token=' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar_pdf', pdf_base64: b64 }) }).catch(() => {});
    } catch (e) { /* el email lleva el documento como respaldo */ }
    finally { setGenerandoPdf(false); }
  }

  useEffect(() => {
    fetch('/api/firmar?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setDoc(j); setEstado('ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) { setArchivo(null); return; }
    if (f.size > 8 * 1024 * 1024) { setError('El documento supera 8 MB. Sube una foto o PDF más ligero.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ''); setArchivo({ base64: r.split(',')[1] || '', nombre: f.name, tipo: f.type, mb: (f.size / 1048576).toFixed(1) }); setError(''); };
    reader.readAsDataURL(f);
  }

  async function pedirCodigo() {
    setError(''); setEnviandoCodigo(true);
    try {
      const r = await fetch('/api/firmar?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar_codigo' }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setCodigoEnviado(true); setEmailMask(j.email || ''); }
      else setError(j.error || 'No se pudo enviar el código.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviandoCodigo(false); }
  }

  async function firmar() {
    if (!firmaImg) { setError('Dibuja tu firma en el recuadro (con el dedo o el ratón).'); return; }
    if (nombre.trim().length < 3) { setError('Escribe tu nombre y apellidos.'); return; }
    if (!acepto) { setError('Marca la casilla de que has leído y aceptas el documento.'); return; }
    if (codigo.trim().length < 4) { setError('Introduce el código que te hemos enviado por email.'); return; }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/firmar?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'firmar', nombre: nombre.trim(), acepto: true, codigo: codigo.trim(), firma_img: firmaImg, dni_unused: undefined, doc_base64: archivo?.base64, doc_nombre: archivo?.nombre, doc_tipo: archivo?.tipo }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setHecho(true); hacerPDF(j.signed_html); }
      else setError(j.error || 'No se pudo firmar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 760, margin: '30px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, boxSizing: 'border-box' };
  const lab = { display: 'block', fontSize: 13, fontWeight: 700, margin: '14px 0 4px' };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando documento…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Documento no disponible</h2>
      <p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

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

            <div style={{ border: '1px solid ' + C.linea, borderRadius: 12, padding: 16, maxHeight: 460, overflow: 'auto', background: '#fff' }}>
              <div dangerouslySetInnerHTML={{ __html: doc.contenido_html || '<p>(Documento sin contenido)</p>' }} />
            </div>

            {hecho || doc.firmado ? (
              <div style={{ marginTop: 22, background: '#eef8f3', border: '1px solid #cfe9d8', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Documento firmado</div>
                <p style={{ color: C.cuerpo, margin: '6px 0 0' }}>Gracias{doc.firmante_nombre ? ', ' + doc.firmante_nombre : (nombre ? ', ' + nombre : '')}. Tu firma ha quedado registrada con fecha, hora, IP y un número de validación. Te enviamos el <b>documento firmado</b> por email.</p>
                {generandoPdf && <p style={{ color: C.tenue, fontSize: 13, marginTop: 12 }}>Preparando tu PDF…</p>}
                {pdfUrl && <a href={pdfUrl} download="contrato-firmado.pdf" style={{ display: 'inline-block', marginTop: 14, background: C.teal, color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 22px', borderRadius: 10 }}>⬇ Descargar tu contrato (PDF)</a>}
              </div>
            ) : doc.firma_estado === 'rechazado' ? (
              <p style={{ marginTop: 20, color: C.tenue, textAlign: 'center' }}>Este documento se marcó como no aceptado. Si fue un error, escríbenos.</p>
            ) : (
              <div style={{ marginTop: 22, background: C.crema, border: '1px solid ' + C.linea, borderRadius: 12, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Firmar el documento</div>

                <label style={lab}>Tu firma (dibújala con el dedo o el ratón)</label>
                <div style={{ background: '#fff', border: '1px solid #d7ddd9', borderRadius: 10, padding: 6 }}>
                  <FirmaCanvas onChange={setFirmaImg} />
                </div>

                <label style={lab}>Nombre y apellidos</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos" style={field} />

                {!doc.tiene_doc && (
                  <>
                    <label style={lab}>Adjunta tu documento de identidad (DNI, NIE, Pasaporte o CIF) — foto o PDF</label>
                    <input type="file" accept="image/*,application/pdf" onChange={onFile} style={{ ...field, padding: 9 }} />
                    {archivo && <p style={{ fontSize: 12, color: C.teal, margin: '4px 0 0' }}>✓ {archivo.nombre} ({archivo.mb} MB)</p>}
                  </>
                )}

                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '16px 0 0', fontSize: 14, color: C.cuerpo, cursor: 'pointer' }}>
                  <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} style={{ flex: '0 0 auto', width: 18, height: 18, marginTop: 2 }} />
                  <span style={{ flex: 1, lineHeight: 1.5 }}>He leído y <b>acepto</b> el contenido de este documento (Hoja de Encargo, Protección de Datos y Contrato de Servicios). Entiendo que mi firma queda registrada con fecha, hora, IP y validación.</span>
                </label>

                <label style={lab}>Código de firma</label>
                {!codigoEnviado ? (
                  <button onClick={pedirCodigo} disabled={enviandoCodigo}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid ' + C.teal, background: '#fff', color: C.teal, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
                    {enviandoCodigo ? 'Enviando…' : '📧 Enviar código a mi email'}
                  </button>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: C.tenue, margin: '0 0 6px' }}>Te enviamos un código a <b>{emailMask}</b>. Introdúcelo aquí:</p>
                    <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos"
                      style={{ ...field, letterSpacing: 6, fontWeight: 700, textAlign: 'center' }} />
                    <button onClick={pedirCodigo} disabled={enviandoCodigo} style={{ background: 'none', border: 0, color: C.teal, fontSize: 12.5, cursor: 'pointer', marginTop: 6, padding: 0 }}>Reenviar código</button>
                  </>
                )}

                {error && <p style={{ color: '#c0392b', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
                <button onClick={firmar} disabled={enviando}
                  style={{ marginTop: 14, width: '100%', padding: '15px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
                  {enviando ? 'Registrando firma…' : '✔ Firmar documento'}
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
