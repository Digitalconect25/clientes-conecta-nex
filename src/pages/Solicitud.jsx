import { useEffect, useState } from 'react';

// Pagina PUBLICA: el cliente elige servicios del catalogo y deja sus datos.
// Sirve para anuncios (link copiable) y para enviar por email tras la llamada.
// ?origen=anuncio marca de donde viene.
export default function Solicitud() {
  const origen = new URLSearchParams(window.location.search).get('origen') || 'formulario';
  const [categorias, setCategorias] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [datos, setDatos] = useState({ nombre: '', empresa: '', email: '', telefono: '', sector: '', mensaje: '' });
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/solicitud').then((r) => r.json()).then((j) => setCategorias(j.categorias || [])).catch(() => {}).finally(() => setCargando(false));
  }, []);

  function toggle(id) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function enviar() {
    setError('');
    if (!datos.nombre.trim()) { setError('Pon tu nombre.'); return; }
    if (!datos.email.trim() && !datos.telefono.trim()) { setError('Deja un email o un telefono.'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/solicitud', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, servicios: [...sel], origen }),
      });
      const j = await r.json();
      if (r.ok && j.ok) setHecho(true);
      else setError(j.error || 'No se pudo enviar.');
    } catch { setError('No se pudo conectar. Intentalo de nuevo.'); }
    finally { setEnviando(false); }
  }

  const wrap = { maxWidth: 620, margin: '40px auto', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#0f1c16' };
  const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 16, padding: 24, boxShadow: '0 6px 24px rgba(16,40,28,.08)' };
  const field = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d7ddd9', fontSize: 15, marginTop: 4 };
  const svc = (on) => ({ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', border: '1px solid ' + (on ? '#16a34a' : '#e3e8e5'), background: on ? '#f0faf3' : '#fff', borderRadius: 11, cursor: 'pointer', marginBottom: 8 });

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
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Cuentanos que necesitas</h2>
        <p style={{ color: '#67756c', marginTop: -6 }}>Elige los servicios que te interesan y dejanos tus datos. Te preparamos una propuesta a medida, sin compromiso.</p>

        <h3 style={{ fontSize: 15 }}>Servicios</h3>
        {cargando ? <p style={{ color: '#67756c' }}>Cargando servicios...</p> : categorias.map((cat) => (
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

        <h3 style={{ fontSize: 15, marginTop: 18 }}>Tus datos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre *<input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} style={field} /></label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Negocio<input value={datos.empresa} onChange={(e) => setDatos({ ...datos, empresa: e.target.value })} style={field} /></label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Email<input type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} style={field} /></label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Telefono<input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} style={field} /></label>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 10 }}>Sector / actividad<input value={datos.sector} onChange={(e) => setDatos({ ...datos, sector: e.target.value })} style={field} placeholder="Ej: restaurante, clinica, tienda..." /></label>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 10 }}>Cuentanos tu idea (opcional)<textarea value={datos.mensaje} onChange={(e) => setDatos({ ...datos, mensaje: e.target.value })} style={{ ...field, minHeight: 80 }} /></label>

        {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
        <button onClick={enviar} disabled={enviando} style={{ marginTop: 14, width: '100%', padding: '13px', borderRadius: 10, border: 0, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {enviando ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </div>
  );
}
