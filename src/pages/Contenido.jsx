import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const ESTADO = {
  borrador: { l: 'Borrador', c: '#64748b' },
  publicado: { l: 'Publicado', c: '#16a34a' },
  error: { l: 'Error', c: '#c0392b' },
};
const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };
const inp = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #d7ddd9', fontSize: 14, boxSizing: 'border-box' };
const fmtFecha = (d) => String(d || '').slice(0, 16).replace('T', ' ');

export default function Contenido() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [iaOn, setIaOn] = useState(false);
  const [wpOn, setWpOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tema, setTema] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [cfgForm, setCfgForm] = useState({ activo: false, temas: '', auto_publicar: false });
  const [wpMsg, setWpMsg] = useState('');

  useEffect(() => { cargar(); cargarCfg(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api.contenidoList();
      setLista(r.contenidos || []);
      setIaOn(!!r.ia_habilitada);
      setWpOn(!!r.wp_habilitado);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }
  async function cargarCfg() {
    try {
      const c = await api.contenidoConfig();
      setCfg(c);
      setCfgForm({ activo: !!c.activo, temas: c.temas || '', auto_publicar: !!c.auto_publicar });
    } catch { /* valores por defecto */ }
  }
  async function guardarCfg() {
    setBusy(true);
    try { const c = await api.contenidoConfigGuardar(cfgForm); setCfg(c); alert('Configuración guardada.'); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function toggleActivo(activo) {
    setCfgForm((f) => ({ ...f, activo }));
    const base = cfg || cfgForm;
    setBusy(true);
    try { const c = await api.contenidoConfigGuardar({ activo, temas: base.temas || '', auto_publicar: !!base.auto_publicar }); setCfg(c); setCfgForm((f) => ({ ...f, activo: !!c.activo })); }
    catch (err) { alert('Error: ' + err.message); setCfgForm((f) => ({ ...f, activo: cfg ? !!cfg.activo : false })); }
    finally { setBusy(false); }
  }

  async function generar() {
    if (!iaOn) { alert('La IA no está configurada (GROQ_API_KEY).'); return; }
    if (!tema.trim()) { alert('Escribe el tema o palabra clave del artículo.'); return; }
    setBusy(true);
    try { const r = await api.contenidoGenerar(tema.trim()); setTema(''); await cargar(); setSel(r.contenido); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function pedirIdeas() {
    if (!iaOn) { alert('La IA no está configurada (GROQ_API_KEY).'); return; }
    setBusy(true);
    try { const r = await api.contenidoIdeas(); setIdeas(r.ideas || []); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function probarWP() {
    setBusy(true); setWpMsg('');
    try { const r = await api.contenidoTestWP(); setWpMsg((r.ok ? '✓ ' : '✗ ') + (r.detalle || '')); }
    catch (err) { setWpMsg('✗ ' + err.message); }
    finally { setBusy(false); }
  }
  async function ejecutarAgente() {
    if (!cfgForm.temas.trim()) { alert('Pon al menos un tema/keyword para el blog.'); return; }
    setBusy(true);
    try {
      const c = await api.contenidoConfigGuardar(cfgForm); setCfg(c);
      const r = await api.contenidoEjecutar();
      alert(`Artículo del tema "${r.tema}": ${r.publicado ? 'publicado en la web ✓' : 'generado como borrador (revísalo y publícalo)'}.`);
      cargarCfg(); cargar();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  const total = lista.length;
  const publicados = lista.filter((c) => c.estado === 'publicado').length;
  const borradores = lista.filter((c) => c.estado === 'borrador').length;

  return (
    <div>
      <h1>Contenido SEO</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>
        El agente redacta artículos de blog orientados a captar negocios locales y los publica en tu web (conectanex.com) para atraer clientes de forma orgánica.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[['Artículos', total], ['Publicados', publicados], ['Borradores', borradores]].map(([l, n]) => (
          <div key={l} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
            <div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
          </div>
        ))}
      </div>

      {!wpOn && (
        <div style={{ ...card, background: '#faf3df', borderColor: '#ecdcae' }}>
          Para publicar en la web añade <b>ROYAL_MCP_API_KEY</b> (y opcionalmente <b>ROYAL_MCP_BASE_URL</b>) en Vercel. Sin eso puedes generar y revisar los artículos, pero no publicarlos.
        </div>
      )}

      {/* Generar artículo */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Generar artículo</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 240 }}>Tema o palabra clave
            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: como aparecer en Google Maps siendo un bar" style={inp} />
          </label>
          <button onClick={generar} disabled={busy || !iaOn} style={{ background: '#0f7a39', color: '#fff' }}>✍️ Generar con IA</button>
          <button onClick={pedirIdeas} disabled={busy || !iaOn}>💡 Ideas de temas</button>
          <button onClick={probarWP} disabled={busy}>Probar conexión WP</button>
        </div>
        {wpMsg && <p style={{ fontSize: 13, color: wpMsg.startsWith('✓') ? '#16a34a' : '#c0392b', margin: '8px 0 0' }}>{wpMsg}</p>}
        {ideas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#67756c', marginBottom: 6 }}>Pulsa una idea para usarla como tema:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ideas.map((i, k) => (
                <button key={k} onClick={() => setTema(i)} style={{ textAlign: 'left', background: '#f6faf7', border: '1px solid #d7e6dd', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 13.5 }}>{i}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Agente de contenido automatico */}
      <div style={{ ...card, borderColor: cfgForm.activo ? '#cfe9d8' : '#e3e8e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>🤖 Agente de contenido (semanal)</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: cfgForm.activo ? '#0f7a39' : '#67756c', cursor: 'pointer' }}>
            <input type="checkbox" checked={cfgForm.activo} disabled={busy} onChange={(e) => toggleActivo(e.target.checked)} />
            {cfgForm.activo ? 'Activo (publica cada lunes)' : 'Desactivado'}
          </label>
        </div>
        <p style={{ color: '#67756c', fontSize: 13.5, margin: '6px 0 12px' }}>
          Cada lunes (9:00) el agente coge el siguiente tema de la lista (van rotando), redacta el artículo y, si activas "publicar automáticamente", lo sube a la web. Si no, lo deja como borrador para que lo revises.
        </p>
        <label>Temas / keywords (separados por comas, rotan)
          <input value={cfgForm.temas} onChange={(e) => setCfgForm({ ...cfgForm, temas: e.target.value })} placeholder="ficha de Google, reseñas, web para negocios, redes sociales locales" style={inp} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14 }}>
          <input type="checkbox" checked={cfgForm.auto_publicar} onChange={(e) => setCfgForm({ ...cfgForm, auto_publicar: e.target.checked })} />
          Publicar automáticamente en la web (si está desmarcado, deja el artículo como borrador para revisar)
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button onClick={guardarCfg} disabled={busy}>Guardar configuración</button>
          <button onClick={ejecutarAgente} disabled={busy} style={{ background: '#0f7a39', color: '#fff' }}>▶ Generar uno ahora</button>
        </div>
        {cfg?.ultima_ejecucion && (
          <p style={{ color: '#67756c', fontSize: 12.5, margin: '10px 0 0', paddingTop: 8, borderTop: '1px solid #eef2f0' }}>
            Última ejecución: <b>{fmtFecha(cfg.ultima_ejecucion)}</b>{cfg.ultimo_resultado ? <> · {cfg.ultimo_resultado}</> : null}
          </p>
        )}
      </div>

      {sel && <EditorContenido key={sel.id} contenido={sel} wpOn={wpOn} onClose={() => setSel(null)} onSaved={() => { setSel(null); cargar(); }} />}

      {/* Lista de artículos */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 10px' }}>Artículos {lista.length ? `(${lista.length})` : ''}</h3>
        {cargando ? <p>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: '#67756c', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: 8 }}>Título</th><th>Tema</th><th>Estado</th><th>Fecha</th><th></th>
            </tr></thead>
            <tbody>
              {lista.map((c) => {
                const e = ESTADO[c.estado] || ESTADO.borrador;
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #eef2f0' }}>
                    <td style={{ padding: 8 }}><b>{c.titulo || '(sin título)'}</b>{c.origen === 'agente' ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: '#5b3fa0', borderRadius: 20, padding: '1px 7px' }}>agente</span> : null}</td>
                    <td style={{ color: '#67756c' }}>{c.tema}</td>
                    <td><span style={{ color: e.c, fontWeight: 600 }}>{e.l}</span>{c.estado === 'error' && c.error ? <div style={{ fontSize: 11, color: '#c0392b' }}>{c.error}</div> : null}</td>
                    <td style={{ color: '#67756c', whiteSpace: 'nowrap' }}>{fmtFecha(c.publicado_en || c.creado_en)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.wp_url ? <a href={c.wp_url} target="_blank" rel="noreferrer" style={{ marginRight: 8, color: '#0f7a39' }}>Ver ↗</a> : null}
                      <button onClick={() => setSel(c)} style={{ padding: '6px 12px', fontSize: 13 }}>Abrir</button>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={5} style={{ padding: 12, color: '#67756c' }}>Aún no hay artículos. Genera uno arriba o activa el agente de contenido.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EditorContenido({ contenido, wpOn, onClose, onSaved }) {
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setC({ ...c, [k]: v });

  useEffect(() => {
    api.contenidoGet(contenido.id).then(setC).catch(() => setC(contenido));
  }, [contenido.id]);

  async function guardar() {
    setBusy(true);
    try { await api.contenidoActualizar(c); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function publicar() {
    if (!wpOn) { alert('WordPress no está configurado (ROYAL_MCP_API_KEY).'); return; }
    if (!confirm('¿Publicar este artículo en la web (conectanex.com)?')) return;
    setBusy(true);
    try { await api.contenidoActualizar(c); const r = await api.contenidoPublicar(c.id); alert('Publicado ✓'); setC(r.contenido); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function borrar() {
    if (!confirm('¿Borrar este artículo del CRM? (No borra la entrada ya publicada en la web.)')) return;
    try { await api.contenidoBorrar(c.id); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
  }

  if (!c) return null;
  const publicado = c.estado === 'publicado';

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,22,.5)', zIndex: 1000, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ ...card, maxWidth: 820, margin: '0 auto', borderColor: '#cfe9d8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', paddingBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Artículo {publicado ? '(publicado)' : '(borrador)'}</h3>
          <button onClick={onClose} style={{ padding: '6px 12px' }}>Cerrar</button>
        </div>
        <label>Título<input value={c.titulo || ''} onChange={(e) => set('titulo', e.target.value)} style={inp} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>Slug (URL)<input value={c.slug || ''} onChange={(e) => set('slug', e.target.value)} style={inp} /></label>
          <label>Etiquetas<input value={c.etiquetas || ''} onChange={(e) => set('etiquetas', e.target.value)} style={inp} placeholder="separadas por comas" /></label>
        </div>
        <label>Meta description (SEO)<input value={c.meta_desc || ''} onChange={(e) => set('meta_desc', e.target.value)} style={inp} maxLength={170} /></label>
        <label>Cuerpo del artículo (HTML)
          <textarea value={c.cuerpo_html || ''} onChange={(e) => set('cuerpo_html', e.target.value)} style={{ ...inp, minHeight: 260, fontFamily: 'monospace', fontSize: 13 }} />
        </label>

        <details style={{ margin: '10px 0' }}>
          <summary style={{ cursor: 'pointer', color: '#0f7a39' }}>Vista previa</summary>
          <div style={{ border: '1px solid #e3e8e5', borderRadius: 10, padding: 16, marginTop: 8, background: '#fff' }}>
            <h2 style={{ marginTop: 0 }}>{c.titulo}</h2>
            <div dangerouslySetInnerHTML={{ __html: c.cuerpo_html || '' }} />
          </div>
        </details>

        {c.wp_url && <p style={{ fontSize: 13 }}>Publicado en: <a href={c.wp_url} target="_blank" rel="noreferrer" style={{ color: '#0f7a39' }}>{c.wp_url}</a></p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={guardar} disabled={busy}>Guardar</button>
          <button onClick={publicar} disabled={busy || !wpOn} style={{ background: '#0f7a39', color: '#fff' }}>{publicado ? 'Volver a publicar' : 'Publicar en la web'}</button>
          <button onClick={borrar} disabled={busy} style={{ color: '#c0392b', marginLeft: 'auto' }}>Borrar</button>
        </div>
        <p style={{ color: '#67756c', fontSize: 11.5 }}>Revisa siempre el texto antes de publicar. El artículo se sube a conectanex.com como entrada del blog.</p>
      </div>
    </div>
  );
}
