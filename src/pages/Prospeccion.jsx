import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const PESTADO = {
  nuevo: { l: 'Nuevo', c: '#64748b' },
  email_enviado: { l: 'Email enviado', c: '#2563eb' },
  respondido: { l: 'Respondio', c: '#b8860b' },
  convertido: { l: 'Convertido', c: '#16a34a' },
  descartado: { l: 'Descartado', c: '#c0392b' },
};
const VACIO = { empresa: '', nombre: '', email: '', telefono: '', sector: '', ciudad: '', website: '', situacion: 'sin_presencia', observaciones: '' };

// Parser CSV: detecta separador (, o ;) y respeta comillas dobles.
function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const semi = (lines[0].match(/;/g) || []).length;
  const coma = (lines[0].match(/,/g) || []).length;
  const d = semi > coma ? ';' : ',';
  return lines.map((line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  });
}

// Convierte filas CSV en objetos prospecto, detectando columnas por la cabecera.
function csvAFilas(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iEmail = col(['email', 'correo', 'e-mail', 'mail']);
  const iEmpresa = col(['empresa', 'negocio', 'comercial', 'razon', 'nombre', 'name', 'title']);
  const iContacto = col(['contacto', 'persona', 'responsable', 'propietario']);
  const iSector = col(['sector', 'actividad', 'categor', 'rubro', 'giro', 'tipo']);
  const iCiudad = col(['ciudad', 'localidad', 'poblaci', 'city', 'municipio']);
  const iWeb = col(['web', 'url', 'sitio', 'site']);
  const iTel = col(['tel', 'phone', 'movil', 'whatsapp']);
  const iObs = col(['observ', 'nota', 'coment', 'descrip']);
  const hasHeader = iEmail >= 0 || iEmpresa >= 0;
  const g = (c, i) => (i >= 0 && i < c.length ? (c[i] || '').trim() : '');
  const filas = [];
  for (let r = hasHeader ? 1 : 0; r < rows.length; r++) {
    const c = rows[r];
    const empresa = hasHeader ? (g(c, iEmpresa) || g(c, iContacto)) : (c[0] || '').trim();
    const email = hasHeader ? g(c, iEmail) : (c[1] || '').trim();
    if (!empresa && !email) continue;
    filas.push({
      empresa, email,
      contacto: hasHeader ? g(c, iContacto) : '',
      telefono: hasHeader ? g(c, iTel) : (c[5] || '').trim(),
      sector: hasHeader ? g(c, iSector) : (c[2] || '').trim(),
      ciudad: hasHeader ? g(c, iCiudad) : (c[3] || '').trim(),
      website: hasHeader ? g(c, iWeb) : (c[4] || '').trim(),
      observaciones: hasHeader ? g(c, iObs) : (c[6] || '').trim(),
    });
  }
  return filas;
}

const card = { background: '#fff', border: '1px solid #e3e8e5', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(16,40,28,.06)' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

export default function Prospeccion() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [iaOn, setIaOn] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [pegar, setPegar] = useState('');
  const [sel, setSel] = useState(null); // prospecto en edicion
  const [busy, setBusy] = useState(false);
  const [marcados, setMarcados] = useState(() => new Set());

  function toggleMarcado(id) {
    setMarcados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTodos() {
    setMarcados((prev) => (prev.size === lista.length ? new Set() : new Set(lista.map((p) => p.id))));
  }
  async function borrarSeleccionados() {
    if (!marcados.size) return;
    if (!confirm(`Eliminar ${marcados.size} prospecto(s) seleccionado(s)?`)) return;
    setBusy(true);
    try { await api.prospectosBorrarVarios([...marcados]); setMarcados(new Set()); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function vaciarTodo() {
    if (!lista.length) return;
    if (!confirm(`Eliminar TODA la lista (${lista.length} prospectos)? Esto no se puede deshacer.`)) return;
    setBusy(true);
    try { const r = await api.prospectosVaciar(); alert(`${r.borrados} prospectos eliminados.`); setMarcados(new Set()); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api.prospectosList();
      setLista(r.prospectos || []);
      setEmailOn(!!r.email_habilitado);
      setIaOn(!!r.ia_habilitada);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }

  async function crear(e) {
    e.preventDefault();
    if (!nuevo.empresa && !nuevo.email) { alert('Pon al menos el negocio o el email.'); return; }
    try { await api.prospectoCrear(nuevo); setNuevo(VACIO); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
  }

  async function importarFilas(filas) {
    if (!filas.length) { alert('No se han detectado filas validas.'); return; }
    setBusy(true);
    try { const r = await api.prospectoImportar(filas); alert(`${r.importados} prospectos importados.`); setPegar(''); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  async function subirCSV(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    importarFilas(csvAFilas(text));
  }

  async function generarTodos() {
    if (!iaOn) { alert('La IA no esta configurada (GROQ_API_KEY).'); return; }
    setBusy(true);
    try { const r = await api.prospectosGenerarTodos(); alert(`${r.generados} emails generados con IA.`); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  async function enviarTodos() {
    if (!emailOn) { alert('El envio no esta configurado (RESEND).'); return; }
    if (!confirm('Enviar el email en frio a todos los prospectos con email y borrador que aun no se han enviado?')) return;
    setBusy(true);
    try { const r = await api.prospectosEnviarTodos(); alert(`Enviados ${r.enviados} de ${r.total}.`); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  const total = lista.length;
  const enviados = lista.filter((p) => p.estado === 'email_enviado' || p.enviado_en).length;
  const respond = lista.filter((p) => p.estado === 'respondido' || p.estado === 'convertido').length;

  return (
    <div>
      <h1>Captacion en frio</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>
        Sube tu base de datos de negocios sin presencia (o mejorable), la IA redacta un email cercano y no agresivo, lo revisas y lo envias.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[['Prospectos', total], ['Emails enviados', enviados], ['Respondieron / convertidos', respond]].map(([l, n]) => (
          <div key={l} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
            <div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
          </div>
        ))}
      </div>

      {!emailOn && (
        <div style={{ ...card, background: '#faf3df', borderColor: '#ecdcae' }}>
          El envio automatico necesita <b>RESEND_API_KEY</b> y <b>RESEND_FROM_EMAIL</b> en Vercel. Sin eso puedes generar y revisar los emails, y enviarlos a mano con <b>Abrir en mi correo</b> dentro de cada prospecto.
        </div>
      )}

      {/* Subir base de datos */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Subir base de datos (.csv)</h3>
        <p style={{ color: '#67756c', fontSize: 14 }}>
          Detectamos solas las columnas habituales (email, empresa/negocio, sector, ciudad, web, telefono, observaciones). Vale CSV con cabecera, separado por comas o punto y coma.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={subirCSV} disabled={busy} />
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#0f7a39' }}>...o pegar en bloque (una linea por prospecto, separado por ;)</summary>
          <p style={{ color: '#67756c', fontSize: 13 }}>Orden: <code>empresa; email; sector; ciudad; web; telefono; observaciones</code></p>
          <textarea value={pegar} onChange={(e) => setPegar(e.target.value)} style={{ width: '100%', minHeight: 110, fontFamily: 'monospace', fontSize: 13 }}
            placeholder={'Bar La Esquina; info@laesquina.com; bar; Alicante; ; +34611000111; no sale en Google Maps'} />
          <button onClick={() => importarFilas(csvAFilas(pegar))} disabled={busy || !pegar.trim()}>Importar pegado</button>
        </details>
      </div>

      {/* Envio en frio */}
      <div style={{ ...card, borderColor: emailOn ? '#cfe9d8' : '#ecdcae' }}>
        <h3 style={{ marginTop: 0 }}>Envio de emails en frio</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={generarTodos} disabled={busy || !iaOn}>Generar emails IA para todos</button>
          <button onClick={enviarTodos} disabled={busy || !emailOn}>Enviar a todos</button>
        </div>
        <p style={{ color: '#67756c', fontSize: 11.5, marginBottom: 0 }}>
          Por tandas (hasta 15 al generar y 40 al enviar por clic). Envia solo a negocios (B2B); cada email incluye tu identificacion y opcion de baja.
        </p>
      </div>

      {/* Anadir prospecto */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Anadir prospecto</h3>
        <form onSubmit={crear}>
          <div style={grid2}>
            <label>Negocio / empresa<input value={nuevo.empresa} onChange={(e) => setNuevo({ ...nuevo, empresa: e.target.value })} placeholder="Ej: Bar La Esquina" /></label>
            <label>Email<input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} placeholder="contacto@negocio.com" /></label>
          </div>
          <div style={grid2}>
            <label>Sector<input value={nuevo.sector} onChange={(e) => setNuevo({ ...nuevo, sector: e.target.value })} placeholder="bar, peluqueria..." /></label>
            <label>Ciudad<input value={nuevo.ciudad} onChange={(e) => setNuevo({ ...nuevo, ciudad: e.target.value })} placeholder="Alicante" /></label>
          </div>
          <div style={grid2}>
            <label>Web / redes<input value={nuevo.website} onChange={(e) => setNuevo({ ...nuevo, website: e.target.value })} placeholder="Vacio si no tiene" /></label>
            <label>Situacion
              <select value={nuevo.situacion} onChange={(e) => setNuevo({ ...nuevo, situacion: e.target.value })}>
                <option value="sin_presencia">Sin presencia online</option>
                <option value="mejorable">Tiene algo, pero mejorable</option>
              </select>
            </label>
          </div>
          <label>Observaciones<input value={nuevo.observaciones} onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })} placeholder="Ej: no sale en Google Maps, Instagram abandonado..." /></label>
          <button type="submit">Anadir prospecto</button>
        </form>
      </div>

      {/* Editor del prospecto seleccionado */}
      {sel && (
        <EditorProspecto
          key={sel.id}
          prospecto={sel}
          emailOn={emailOn}
          iaOn={iaOn}
          onClose={() => setSel(null)}
          onSaved={() => { setSel(null); cargar(); }}
        />
      )}

      {/* Tabla */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Prospectos {lista.length ? `(${lista.length})` : ''}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={borrarSeleccionados} disabled={busy || !marcados.size} style={{ color: marcados.size ? '#c0392b' : undefined }}>
              Eliminar seleccionados{marcados.size ? ` (${marcados.size})` : ''}
            </button>
            <button onClick={vaciarTodo} disabled={busy || !lista.length} style={{ color: '#c0392b' }}>Vaciar lista</button>
          </div>
        </div>
        {cargando ? <p>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 10 }}>
            <thead><tr style={{ textAlign: 'left', color: '#67756c', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: 8 }}><input type="checkbox" checked={lista.length > 0 && marcados.size === lista.length} onChange={toggleTodos} title="Seleccionar todos" /></th>
              <th>Negocio</th><th>Email</th><th>Situacion</th><th>Email IA</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {lista.map((p) => {
                const e = PESTADO[p.estado] || PESTADO.nuevo;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #eef2f0', background: marcados.has(p.id) ? '#fef4f4' : undefined }}>
                    <td style={{ padding: 8 }}><input type="checkbox" checked={marcados.has(p.id)} onChange={() => toggleMarcado(p.id)} /></td>
                    <td style={{ padding: 8 }}><b>{p.empresa || p.nombre || '-'}</b><br /><span style={{ color: '#67756c' }}>{p.sector}{p.ciudad ? ' - ' + p.ciudad : ''}</span></td>
                    <td>{p.email || <span style={{ color: '#94a3b8' }}>sin email</span>}</td>
                    <td>{p.situacion === 'mejorable' ? 'Mejorable' : 'Sin presencia'}</td>
                    <td style={{ textAlign: 'center' }}>{p.email_borrador ? 'Si' : '-'}</td>
                    <td><span style={{ color: e.c, fontWeight: 600 }}>{e.l}</span></td>
                    <td><button onClick={() => setSel(p)} style={{ padding: '6px 12px', fontSize: 13 }}>Abrir</button></td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={7} style={{ padding: 12, color: '#67756c' }}>Aun no hay prospectos. Sube un CSV o anade uno arriba.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EditorProspecto({ prospecto, emailOn, iaOn, onClose, onSaved }) {
  const [p, setP] = useState(prospecto);
  const [busy, setBusy] = useState(false);
  const [nif, setNif] = useState('');
  const navigate = useNavigate();
  const set = (k, v) => setP({ ...p, [k]: v });

  async function convertir() {
    if (!nif.trim()) { alert('El NIF/CIF es obligatorio para crear el cliente.'); return; }
    if (!confirm('Crear el cliente "' + (p.empresa || p.nombre || '') + '" en el sistema?')) return;
    setBusy(true);
    try {
      const r = await api.prospectoConvertir(p.id, {
        nif, nombre: p.empresa || p.nombre, contacto: p.nombre || '',
        email: p.email || '', telefono: p.telefono || '', ciudad: p.ciudad || '',
      });
      alert('Cliente creado: ' + r.numero_cliente);
      navigate('/clientes/' + r.cliente_id);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  async function guardar() {
    setBusy(true);
    try { await api.prospectoActualizar(p); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function generar() {
    if (!iaOn) { alert('La IA no esta configurada (GROQ_API_KEY).'); return; }
    setBusy(true);
    try { await api.prospectoActualizar(p); const row = await api.prospectoGenerar(p.id); setP(row); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function enviar() {
    if (!emailOn) { alert('El envio no esta configurado (RESEND).'); return; }
    if (!confirm('Enviar este email en frio a ' + (p.email || 'el prospecto') + '?')) return;
    setBusy(true);
    try { const row = await api.prospectoEnviar(p.id, { asunto: p.asunto, email_borrador: p.email_borrador }); setP(row); alert('Email enviado.'); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function borrar() {
    if (!confirm('Borrar este prospecto?')) return;
    try { await api.prospectoBorrar(p.id); onSaved(); }
    catch (err) { alert('Error: ' + err.message); }
  }
  function abrirMiCorreo() {
    if (!p.email) { alert('Este prospecto no tiene email.'); return; }
    // El cuerpo puede venir en HTML; lo pasamos a texto plano para el mailto.
    const texto = String(p.email_borrador || '').replace(/<br\s*\/?>(\n)?/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
    window.location.href = 'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent(p.asunto || '') + '&body=' + encodeURIComponent(texto);
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,22,.5)', zIndex: 1000, overflowY: 'auto', padding: '24px 16px' }}
    >
      <div style={{ ...card, maxWidth: 760, margin: '0 auto', borderColor: '#cfe9d8', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', paddingBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Prospecto: {p.empresa || p.nombre || 'Sin nombre'}</h3>
        <button onClick={onClose} style={{ padding: '6px 12px' }}>Cerrar</button>
      </div>
      <div style={grid2}>
        <label>Negocio<input value={p.empresa || ''} onChange={(e) => set('empresa', e.target.value)} /></label>
        <label>Email<input value={p.email || ''} onChange={(e) => set('email', e.target.value)} /></label>
      </div>
      <div style={grid2}>
        <label>Sector<input value={p.sector || ''} onChange={(e) => set('sector', e.target.value)} /></label>
        <label>Ciudad<input value={p.ciudad || ''} onChange={(e) => set('ciudad', e.target.value)} /></label>
      </div>
      <div style={grid2}>
        <label>Web / redes<input value={p.website || ''} onChange={(e) => set('website', e.target.value)} /></label>
        <label>Situacion
          <select value={p.situacion || 'sin_presencia'} onChange={(e) => set('situacion', e.target.value)}>
            <option value="sin_presencia">Sin presencia online</option>
            <option value="mejorable">Tiene algo, pero mejorable</option>
          </select>
        </label>
      </div>
      <label>Observaciones<input value={p.observaciones || ''} onChange={(e) => set('observaciones', e.target.value)} /></label>
      <div style={grid2}>
        <label>Persona de contacto<input value={p.nombre || ''} onChange={(e) => set('nombre', e.target.value)} /></label>
        <label>Estado
          <select value={p.estado || 'nuevo'} onChange={(e) => set('estado', e.target.value)}>
            {Object.keys(PESTADO).map((k) => <option key={k} value={k}>{PESTADO[k].l}</option>)}
          </select>
        </label>
      </div>

      {/* Convertir en cliente (cuando responde / se convierte) */}
      <div style={{ background: '#f0faf3', border: '1px solid #cfe9d8', borderRadius: 10, padding: 14, marginTop: 14 }}>
        {p.cliente_id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>Ya es cliente en el sistema.</b>
            <button onClick={() => navigate('/clientes/' + p.cliente_id)} style={{ background: '#16a34a', color: '#fff' }}>Abrir ficha del cliente</button>
          </div>
        ) : (
          <div>
            <b>Te ha respondido? Conviertelo en cliente</b>
            <p style={{ color: '#67756c', fontSize: 13, margin: '4px 0 10px' }}>Crea el registro en Clientes con los datos del prospecto. El NIF/CIF es obligatorio.</p>
            <div style={grid2}>
              <label>NIF / CIF *<input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="B12345678" /></label>
              <label>Contacto<input value={p.nombre || ''} onChange={(e) => set('nombre', e.target.value)} placeholder="Persona de contacto" /></label>
            </div>
            <button onClick={convertir} disabled={busy} style={{ background: '#16a34a', color: '#fff' }}>Convertir en cliente</button>
          </div>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #e3e8e5', margin: '16px 0' }} />
      <h4 style={{ margin: '0 0 8px' }}>Email en frio</h4>
      <label>Asunto<input value={p.asunto || ''} onChange={(e) => set('asunto', e.target.value)} placeholder="(se genera con la IA)" /></label>
      <label>Cuerpo del email
        <textarea value={p.email_borrador || ''} onChange={(e) => set('email_borrador', e.target.value)} style={{ width: '100%', minHeight: 180 }} placeholder="Pulsa 'Generar con IA' o escribelo tu" />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <button onClick={guardar} disabled={busy}>Guardar</button>
        <button onClick={generar} disabled={busy || !iaOn}>Generar con IA</button>
        <button onClick={enviar} disabled={busy || !emailOn}>Enviar email</button>
        <button onClick={abrirMiCorreo} disabled={busy}>Abrir en mi correo</button>
        <button onClick={borrar} disabled={busy} style={{ color: '#c0392b', marginLeft: 'auto' }}>Borrar</button>
      </div>
      <p style={{ color: '#67756c', fontSize: 11.5 }}>
        Al enviar se anade tu identificacion y una opcion de baja (obligatorio por la LSSI). Envia solo a negocios (B2B). "Abrir en mi correo" abre Gmail/Outlook con el mensaje ya escrito.
      </p>
      </div>
    </div>
  );
}
