import { useEffect, useState } from 'react';

// Pagina PUBLICA: asistente por pasos (como el cotizador local).
//  1) Tus datos  2) Tu negocio + recomendacion IA  3) Servicios  4) Resumen/enviar
// ?origen=anuncio marca de donde viene. Sirve para anuncios y para enviar por email.
export default function Solicitud() {
  const origen = new URLSearchParams(window.location.search).get('origen') || 'formulario';
  const [paso, setPaso] = useState(1);
  const [categorias, setCategorias] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [datos, setDatos] = useState({ nombre: '', empresa: '', email: '', telefono: '', sector: '', mensaje: '' });
  const [reco, setReco] = useState('');
  const [recomendando, setRecomendando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/solicitud').then((r) => r.json()).then((j) => setCategorias(j.categorias || [])).catch(() => {});
  }, []);

  function toggle(id) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  const d = (k, v) => setDatos({ ...datos, [k]: v });

  function ir(n) {
    setError('');
    if (n > paso) {
      if (paso === 1) {
        if (!datos.nombre.trim()) { setError('Pon tu nombre para continuar.'); return; }
        if (!datos.email.trim() && !datos.telefono.trim()) { setError('Deja un email o un telefono.'); return; }
      }
    }
    setPaso(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function recomendar() {
    setRecomendando(true); setReco('Analizando tu negocio...');
    try {
      const r = await fetch('/api/solicitud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'recomendar', sector: datos.sector, necesidad: datos.mensaje }) });
      const j = await r.json();
      setReco(j.recomendacion || 'No se pudo generar la recomendacion.');
    } catch { setReco('No se pudo conectar con la IA ahora mismo.'); }
    finally { setRecomendando(false); }
  }

  async function enviar() {
    setError('');
    if (!datos.nombre.trim()) { setError('Falta tu nombre.'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/solicitud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...datos, servicios: [...sel], origen }) });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true);
      else setError(j.error || 'No se pudo enviar.');
    } catch { setError('No se pudo conectar. Intentalo de nuevo.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 620, margin: '40px auto', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#0f1c16' };
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 16, padding: 24, boxShadow: '0 6px 24px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, marginTop: 4 };
  const lbl = { fontSize: 13, fontWeight: 600, display: 'block', marginTop: 10 };
  const svc = (on) => ({ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', border: '1px solid ' + (on ? '#16a34a' : '#e3e8e5'), background: on ? '#f0faf3' : '#fff', borderRadius: 11, cursor: 'pointer', marginBottom: 8 });
  const btnP = { padding: '12px 20px', borderRadius: 10, border: 0, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' };
  const btnG = { padding: '12px 20px', borderRadius: 10, border: '1px solid #d7ddd9', background: '#fff', color: '#0f1c16', fontWeight: 600, fontSize: 15, cursor: 'pointer' };
  const pasos = ['Tus datos', 'Tu negocio', 'Servicios', 'Resumen'];

  if (hecho) {
    return (
      <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#eaf6ee', color: '#0f7a39', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 8 }}>✓</div>
        <h2 style={{ margin: '6px 0' }}>Solicitud enviada</h2>
        <p style={{ color: '#67756c' }}>Gracias, {datos.nombre}. Hemos recibido tus datos y te contactaremos muy pronto.</p>
      </div></div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Conecta <span style={{ color: '#16a34a' }}>Nex</span></div>
        <div style={{ color: '#67756c', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Digital Conect</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {pasos.map((t, i) => (
          <div key={t} style={{ flex: 1, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 600, color: paso === i + 1 ? '#16a34a' : '#9aa6a0', paddingBottom: 8, borderBottom: '2px solid ' + (paso >= i + 1 ? '#16a34a' : '#e3e8e5') }}>{i + 1} {t}</div>
        ))}
      </div>

      <div style={card}>
        {paso === 1 && (
          <div>
            <h2 style={{ marginTop: 0 }}>Empecemos por conocerte</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={lbl}>Nombre y apellidos *<input value={datos.nombre} onChange={(e) => d('nombre', e.target.value)} style={field} placeholder="Tu nombre" /></label>
              <label style={lbl}>Nombre del negocio<input value={datos.empresa} onChange={(e) => d('empresa', e.target.value)} style={field} placeholder="Tu negocio" /></label>
              <label style={lbl}>Email<input type="email" value={datos.email} onChange={(e) => d('email', e.target.value)} style={field} placeholder="tucorreo@ejemplo.com" /></label>
              <label style={lbl}>Telefono<input value={datos.telefono} onChange={(e) => d('telefono', e.target.value)} style={field} placeholder="+34 ..." /></label>
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
            <div style={{ textAlign: 'right', marginTop: 16 }}><button style={btnP} onClick={() => ir(2)}>Siguiente</button></div>
          </div>
        )}

        {paso === 2 && (
          <div>
            <h2 style={{ marginTop: 0 }}>Cuentanos sobre tu negocio</h2>
            <label style={lbl}>Sector / actividad<input value={datos.sector} onChange={(e) => d('sector', e.target.value)} style={field} placeholder="Ej: restaurante, clinica, tienda, peluqueria..." /></label>
            <label style={lbl}>Que necesitas / que te gustaria conseguir<textarea value={datos.mensaje} onChange={(e) => d('mensaje', e.target.value)} style={{ ...field, minHeight: 90 }} placeholder="Ej: quiero mas clientes y fidelizar a los que ya tengo" /></label>
            <button onClick={recomendar} disabled={recomendando} style={{ ...btnG, marginTop: 12, borderColor: '#16a34a', color: '#0f7a39' }}>{recomendando ? 'Pensando...' : 'Recomiendame con IA'}</button>
            {reco && <div style={{ background: '#f0faf3', border: '1px solid #cfe9d8', borderRadius: 12, padding: 14, marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 14, color: '#1f2a24' }}>{reco}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}><button style={btnG} onClick={() => ir(1)}>Atras</button><button style={btnP} onClick={() => ir(3)}>Ver servicios</button></div>
          </div>
        )}

        {paso === 3 && (
          <div>
            <h2 style={{ marginTop: 0 }}>Elige los servicios que te interesan</h2>
            <p style={{ color: '#67756c', marginTop: -6 }}>Marca los que quieras. Si no estas seguro, dejalo y lo vemos en la llamada.</p>
            {categorias.length === 0 ? <p style={{ color: '#67756c' }}>Cargando servicios...</p> : categorias.map((cat) => (
              <div key={cat.categoria} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#67756c', margin: '10px 0 6px' }}>{cat.categoria}</div>
                {cat.servicios.map((s) => (
                  <label key={s.id} style={svc(sel.has(s.id))}>
                    <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} style={{ marginTop: 3 }} />
                    <span><b style={{ fontSize: 14 }}>{s.nombre}</b>{s.descripcion ? <><br /><span style={{ fontSize: 12, color: '#67756c' }}>{s.descripcion}</span></> : null}</span>
                  </label>
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}><button style={btnG} onClick={() => ir(2)}>Atras</button><button style={btnP} onClick={() => ir(4)}>Continuar</button></div>
          </div>
        )}

        {paso === 4 && (
          <div>
            <h2 style={{ marginTop: 0 }}>Revisa y envia</h2>
            <p style={{ color: '#67756c' }}>Te preparamos una propuesta a medida y te contactamos. Sin compromiso.</p>
            <div style={{ fontSize: 14 }}>
              <p><b>{datos.nombre}</b>{datos.empresa ? ' - ' + datos.empresa : ''}<br />{datos.email} {datos.telefono}<br />{datos.sector}</p>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#67756c' }}>Servicios que te interesan</div>
              {[...sel].length ? (
                <ul>{categorias.flatMap((c) => c.servicios).filter((s) => sel.has(s.id)).map((s) => <li key={s.id}>{s.nombre}</li>)}</ul>
              ) : <p style={{ color: '#67756c' }}>No has marcado servicios (lo vemos en la llamada).</p>}
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}><button style={btnG} onClick={() => ir(3)}>Atras</button><button style={btnP} onClick={enviar} disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar solicitud'}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
