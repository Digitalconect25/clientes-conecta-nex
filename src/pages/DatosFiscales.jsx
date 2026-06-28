import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

export default function DatosFiscales() {
  const { token } = useParams();
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [d, setD] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [archivo, setArchivo] = useState(null);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) { setArchivo(null); return; }
    if (f.size > 8 * 1024 * 1024) { setError('El archivo supera 8 MB. Sube una foto o PDF más ligero.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ''); setArchivo({ base64: r.split(',')[1] || '', nombre: f.name, tipo: f.type, mb: (f.size / 1048576).toFixed(1) }); setError(''); };
    reader.readAsDataURL(f);
  }

  useEffect(() => {
    fetch('/api/datos-fiscales?token=' + encodeURIComponent(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) { setD(j); setEstado(j.estado === 'completado' ? 'completado' : 'ok'); } else { setError(j.error || 'No disponible'); setEstado('error'); } })
      .catch(() => { setError('No se pudo cargar.'); setEstado('error'); });
  }, [token]);

  const set = (k, v) => setD({ ...d, [k]: v });
  async function guardar() {
    if (!String(d.nombre || '').trim()) { setError(d.tipo_persona === 'Juridica' ? 'Escribe la razón social.' : 'Escribe tu nombre completo.'); return; }
    if (!String(d.nif || '').trim()) { setError(d.tipo_persona === 'Juridica' ? 'Escribe el CIF.' : 'Escribe el NIF/DNI.'); return; }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/datos-fiscales?token=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, dni_base64: archivo?.base64, dni_nombre: archivo?.nombre, dni_tipo: archivo?.tipo }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true); else setError(j.error || 'No se pudo guardar.');
    } catch { setError('No se pudo conectar.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 600, margin: '34px auto', padding: '0 16px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, boxSizing: 'border-box', marginTop: 4 };
  const lab = { display: 'block', fontSize: 13, fontWeight: 600, marginTop: 12 };

  if (estado === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando…</div>;
  if (estado === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Enlace no disponible</h2><p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  const exito = hecho || estado === 'completado';
  const juridica = d.tipo_persona === 'Juridica';

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '24px 28px 14px', borderBottom: '1px solid #f2eee3' }}>
            <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, height: 'auto' }} />
          </div>
          <div style={{ padding: '24px 28px 28px' }}>
            {exito ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 10 }}>✓</div>
                <h2 style={{ margin: '0 0 6px' }}>¡Datos recibidos!</h2>
                <p style={{ color: C.cuerpo }}>Gracias. Ya tenemos tus datos fiscales para preparar el contrato. Te lo enviaremos en breve para firmar.</p>
              </div>
            ) : (
              <>
                <h1 style={{ margin: '0 0 2px', fontSize: 22 }}>Tus datos fiscales</h1>
                <div style={{ height: 3, width: 44, background: C.teal, borderRadius: 3, margin: '10px 0 14px' }} />
                <p style={{ color: C.cuerpo, margin: '0 0 12px' }}>Necesitamos estos datos para preparar tu contrato. Solo te llevará un minuto.</p>

                <label style={lab}>¿Eres particular o empresa?
                  <select value={d.tipo_persona} onChange={(e) => set('tipo_persona', e.target.value)} style={field}>
                    <option value="Fisica">Particular / autónomo</option>
                    <option value="Juridica">Empresa (sociedad)</option>
                  </select>
                </label>
                <label style={lab}>{juridica ? 'Razón social *' : 'Nombre y apellidos *'}
                  <input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={field} />
                </label>
                <label style={lab}>{juridica ? 'CIF *' : 'NIF / DNI *'}
                  <input value={d.nif} onChange={(e) => set('nif', e.target.value)} style={field} placeholder={juridica ? 'B12345678' : '12345678Z'} />
                </label>
                {juridica && (
                  <label style={lab}>Persona de contacto / representante
                    <input value={d.contacto} onChange={(e) => set('contacto', e.target.value)} style={field} />
                  </label>
                )}
                <label style={lab}>Dirección
                  <input value={d.direccion} onChange={(e) => set('direccion', e.target.value)} style={field} placeholder="Calle, número" />
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ ...lab, flex: '0 0 30%' }}>Código postal
                    <input value={d.cp} onChange={(e) => set('cp', e.target.value)} style={field} />
                  </label>
                  <label style={{ ...lab, flex: 1 }}>Ciudad
                    <input value={d.ciudad} onChange={(e) => set('ciudad', e.target.value)} style={field} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ ...lab, flex: 1 }}>Provincia
                    <input value={d.provincia} onChange={(e) => set('provincia', e.target.value)} style={field} />
                  </label>
                  <label style={{ ...lab, flex: 1 }}>País
                    <input value={d.pais} onChange={(e) => set('pais', e.target.value)} style={field} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ ...lab, flex: 1 }}>Email
                    <input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} style={field} />
                  </label>
                  <label style={{ ...lab, flex: 1 }}>Teléfono
                    <input value={d.telefono} onChange={(e) => set('telefono', e.target.value)} style={field} />
                  </label>
                </div>
                <label style={lab}>{juridica ? 'CIF o escritura (foto o PDF)' : 'DNI por las dos caras (foto o PDF)'}
                  <input type="file" accept="image/*,application/pdf" onChange={onFile} style={{ ...field, padding: 9 }} />
                </label>
                {archivo && <p style={{ fontSize: 12, color: C.teal, marginTop: 4 }}>✓ {archivo.nombre} ({archivo.mb} MB)</p>}
                <p style={{ fontSize: 11.5, color: '#9aa6a0', marginTop: 4 }}>Lo usamos solo para identificarte en el contrato. Opcional ahora; si no, te lo pediremos al firmar.</p>

                {error && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>{error}</p>}
                <button onClick={guardar} disabled={enviando}
                  style={{ marginTop: 18, width: '100%', padding: '14px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: enviando ? 0.7 : 1 }}>
                  {enviando ? 'Guardando…' : 'Enviar mis datos'}
                </button>
                <p style={{ fontSize: 11.5, color: '#9aa6a0', marginTop: 10 }}>Tratamos tus datos conforme al RGPD para gestionar el contrato. Responsable: Conecta NEX. Puedes ejercer tus derechos escribiéndonos.</p>
              </>
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
