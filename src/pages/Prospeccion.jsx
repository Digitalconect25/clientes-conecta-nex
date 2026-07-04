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
// Etapas de EVOLUCION del lead en el embudo (las recalcula el servidor con cada senal).
const ETAPA = {
  frio: { l: 'En frío', c: '#64748b', i: '🧊' },
  contactado: { l: 'Contactado', c: '#2563eb', i: '✉️' },
  seguimiento: { l: 'En seguimiento', c: '#7c3aed', i: '🔁' },
  interesado: { l: 'Interesado', c: '#b8860b', i: '⭐' },
  caliente: { l: 'Caliente', c: '#ea580c', i: '🔥' },
  cliente: { l: 'Cliente', c: '#16a34a', i: '🏆' },
  descartado: { l: 'Descartado', c: '#c0392b', i: '✖' },
};
const ETAPAS_ORDEN = ['frio', 'contactado', 'seguimiento', 'interesado', 'caliente', 'cliente'];
const EVENTO_ICONO = { alta: '📥', email: '✉️', seguimiento: '🔁', interes: '⭐', respuesta: '💬', etapa: '📈', convertido: '🏆' };
const fmtFecha = (d) => String(d || '').slice(0, 16).replace('T', ' ');
const badgeEtapa = (et, extra = {}) => {
  const x = ETAPA[et] || ETAPA.frio;
  return <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: x.c, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap', ...extra }}>{x.i} {x.l}</span>;
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
  const [vista, setVista] = useState('sin');
  const [pegar, setPegar] = useState('');
  const [sel, setSel] = useState(null); // prospecto en edicion
  const [busy, setBusy] = useState(false);
  const [marcados, setMarcados] = useState(() => new Set());
  const [emailPrueba, setEmailPrueba] = useState('');
  const [cfg, setCfg] = useState(null); // configuracion del agente de captacion diaria
  const [cfgForm, setCfgForm] = useState({ activo: false, ciudad: '', nichos: '', limite_diario: 10 });
  const [etapaFiltro, setEtapaFiltro] = useState('');

  function toggleMarcado(id) {
    setMarcados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  // Selecciona/deselecciona solo los VISIBLES (filtrada), no toda la lista: asi el
  // borrado nunca elimina en silencio prospectos ocultos por el filtro activo.
  function toggleTodos() {
    const ids = filtrada.map((p) => p.id);
    setMarcados((prev) => {
      const todos = ids.length > 0 && ids.every((id) => prev.has(id));
      const n = new Set(prev);
      ids.forEach((id) => (todos ? n.delete(id) : n.add(id)));
      return n;
    });
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

  useEffect(() => { cargar(); cargarCfg(); }, []);

  // Olvida los marcados que dejan de ser visibles (al cambiar de filtro O cuando la
  // lista se recarga/reclasifica): evita borrar sin querer prospectos ocultos que
  // quedaron seleccionados. Depende tambien de `lista` porque `filtrada` deriva de ella.
  useEffect(() => {
    setMarcados((prev) => {
      if (!prev.size) return prev;
      const visibles = new Set(filtrada.map((p) => p.id));
      const n = new Set([...prev].filter((id) => visibles.has(id)));
      return n.size === prev.size ? prev : n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, etapaFiltro, lista]);

  async function cargar() {
    setCargando(true);
    try {
      // Recalcula la evolucion en el servidor antes de pintar la lista (etapas al dia).
      await api.prospectosEvolucion().catch(() => null);
      const r = await api.prospectosList();
      setLista(r.prospectos || []);
      setEmailOn(!!r.email_habilitado);
      setIaOn(!!r.ia_habilitada);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setCargando(false); }
  }

  async function cargarCfg() {
    try {
      const c = await api.captacionConfig();
      setCfg(c);
      setCfgForm({ activo: !!c.activo, ciudad: c.ciudad || '', nichos: c.nichos || '', limite_diario: c.limite_diario || 10 });
    } catch { /* el panel del agente queda con valores por defecto */ }
  }
  async function guardarCfg() {
    setBusy(true);
    try {
      const c = await api.captacionGuardar(cfgForm);
      setCfg(c);
      setCfgForm({ activo: !!c.activo, ciudad: c.ciudad || '', nichos: c.nichos || '', limite_diario: c.limite_diario || 10 });
      alert('Configuración del agente guardada.');
    } catch (err) {
      alert('Error: ' + err.message);
      // Revierte al ultimo estado confirmado por el servidor; si no hay cfg (carga inicial
      // fallida), al menos deja 'activo' en false para no mostrarlo activo sin persistir.
      setCfgForm((prev) => cfg
        ? { activo: !!cfg.activo, ciudad: cfg.ciudad || '', nichos: cfg.nichos || '', limite_diario: cfg.limite_diario || 10 }
        : { ...prev, activo: false });
    }
    finally { setBusy(false); }
  }
  // Activar/desactivar el agente NO debe arrastrar ediciones sin guardar de ciudad/nichos:
  // se persiste solo el flag sobre la config confirmada (cfg), conservando lo tecleado.
  async function toggleActivo(activo) {
    setCfgForm((f) => ({ ...f, activo })); // optimista
    const base = cfg || cfgForm;
    setBusy(true);
    try {
      const c = await api.captacionGuardar({ activo, ciudad: base.ciudad || '', nichos: base.nichos || '', limite_diario: base.limite_diario || 10 });
      setCfg(c);
      setCfgForm((f) => ({ ...f, activo: !!c.activo })); // solo el flag; conserva ediciones
    } catch (err) {
      alert('Error: ' + err.message);
      setCfgForm((f) => ({ ...f, activo: cfg ? !!cfg.activo : false })); // revierte siempre el flag
    }
    finally { setBusy(false); }
  }
  async function ejecutarAgente() {
    if (!cfgForm.ciudad.trim()) { alert('Pon la ciudad donde quieres captar clientes.'); return; }
    if (!cfgForm.nichos.trim()) { alert('Pon al menos un nicho (ej: peluquería, fontanero, restaurante).'); return; }
    setBusy(true);
    try {
      const c = await api.captacionGuardar(cfgForm); setCfg(c);
      const r = await api.captacionEjecutar();
      alert(`Scrapeo de "${r.nicho}" en ${r.ciudad}:\n· ${r.insertados} negocios nuevos en frío (${r.duplicados} ya estaban)\n· ${r.enriquecidos} emails encontrados\n· ${r.redactados} borradores redactados por la IA`);
      cargarCfg(); cargar();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
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
  async function puntuar() {
    if (!iaOn) { alert('La IA no esta configurada (GROQ_API_KEY).'); return; }
    setBusy(true);
    try { const r = await api.prospectosPuntuar(); alert(`${r.puntuados} leads priorizados por la IA.`); cargar(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }
  async function enviarPrueba() {
    if (!emailOn) { alert('El envio no esta configurado (RESEND).'); return; }
    setBusy(true);
    try { const r = await api.prospectoEmailPrueba(emailPrueba); alert('Email de prueba enviado a ' + r.to + '. Revisa tu bandeja (y spam).'); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setBusy(false); }
  }

  const PRIO = { Alta: '#16a34a', Media: '#b8860b', Baja: '#94a3b8' };
  const ordP = (x) => ({ Alta: 3, Media: 2, Baja: 1 }[x] || 0);
  const total = lista.length;
  const enviados = lista.filter((p) => p.estado === 'email_enviado' || p.enviado_en).length;
  const respond = lista.filter((p) => p.estado === 'respondido' || p.estado === 'convertido').length;
  const etapaDe = (p) => (p.etapa && ETAPA[p.etapa] ? p.etapa : 'frio');
  const porEtapa = lista.reduce((acc, p) => { const e = etapaDe(p); acc[e] = (acc[e] || 0) + 1; return acc; }, {});
  const filtrada = lista.filter((p) => {
    const okVista = vista === 'todos'
      ? true
      : vista === 'sin'
        ? (!p.estado || p.estado === 'nuevo')
        : vista === 'cont'
          ? p.estado === 'email_enviado'
          : (p.estado === 'respondido' || p.estado === 'convertido');
    const okEtapa = !etapaFiltro || etapaDe(p) === etapaFiltro;
    return okVista && okEtapa;
  });
  // "Proximo nicho" desde la config GUARDADA (cfg), no del textarea sin guardar (cfgForm),
  // para que coincida con lo que el agente scrapearia realmente.
  const nichosCfg = String(cfg?.nichos || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const nichoHoy = nichosCfg.length ? nichosCfg[(((cfg?.nicho_idx || 0) % nichosCfg.length) + nichosCfg.length) % nichosCfg.length] : '';
  const cfgSinGuardar = !!cfg && (cfgForm.ciudad !== (cfg.ciudad || '') || cfgForm.nichos !== (cfg.nichos || '') || String(cfgForm.limite_diario) !== String(cfg.limite_diario || 10));

  return (
    <div>
      <h1>Captacion en frio</h1>
      <p style={{ color: '#67756c', marginTop: -6 }}>
        El agente scrapea cada dia negocios de tu ciudad, la IA redacta el primer contacto y el embudo mide como evolucionan: de leads en frio a interesados, calientes y clientes.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[['Prospectos', total], ['Emails enviados', enviados], ['Respondieron / convertidos', respond]].map(([l, n]) => (
          <div key={l} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
            <div style={{ fontSize: 12, color: '#67756c', textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Agente de captacion diaria (scrapeo automatico por ciudad) */}
      <div style={{ ...card, borderColor: cfgForm.activo ? '#cfe9d8' : '#e3e8e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>🤖 Agente de captación diaria</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: cfgForm.activo ? '#0f7a39' : '#67756c', cursor: 'pointer' }}>
            <input type="checkbox" checked={cfgForm.activo} disabled={busy}
              onChange={(e) => toggleActivo(e.target.checked)} />
            {cfgForm.activo ? 'Activo (scrapea cada mañana)' : 'Desactivado'}
          </label>
        </div>
        <p style={{ color: '#67756c', fontSize: 13.5, margin: '6px 0 12px' }}>
          Cada mañana (lun-sáb, con el cron de las 8:00) busca en Google negocios del nicho que toque en la <b>ciudad que pongas</b>, los añade como leads <b>en frío</b>, la IA los prioriza, localiza su email y deja redactado el primer contacto. Los nichos van rotando día a día.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 120px', gap: 12 }}>
          <label>Ciudad<input value={cfgForm.ciudad} onChange={(e) => setCfgForm({ ...cfgForm, ciudad: e.target.value })} placeholder="Alicante" /></label>
          <label>Nichos (separados por comas)<input value={cfgForm.nichos} onChange={(e) => setCfgForm({ ...cfgForm, nichos: e.target.value })} placeholder="peluquería, fontanero, restaurante, clínica dental" /></label>
          <label>Negocios / día<input type="number" min="1" max="20" value={cfgForm.limite_diario} onChange={(e) => setCfgForm({ ...cfgForm, limite_diario: e.target.value })} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <button onClick={() => guardarCfg()} disabled={busy}>Guardar configuración</button>
          <button onClick={ejecutarAgente} disabled={busy} style={{ background: '#0f7a39', color: '#fff' }}>▶ Ejecutar scrapeo ahora</button>
          {nichoHoy && !cfgSinGuardar && <span style={{ fontSize: 13, color: '#67756c' }}>Próximo nicho: <b>{nichoHoy}</b>{cfg?.ciudad ? <> en <b>{cfg.ciudad}</b></> : null}</span>}
          {cfgSinGuardar && <span style={{ fontSize: 13, color: '#b8860b' }}>Tienes cambios sin guardar. Pulsa "Guardar configuración" para aplicarlos.</span>}
        </div>
        {cfg?.ultima_ejecucion && (
          <p style={{ color: '#67756c', fontSize: 12.5, margin: '10px 0 0', paddingTop: 8, borderTop: '1px solid #eef2f0' }}>
            Última ejecución: <b>{fmtFecha(cfg.ultima_ejecucion)}</b>{cfg.ultimo_resultado ? <> · {cfg.ultimo_resultado}</> : null}
          </p>
        )}
      </div>

      {/* Embudo de EVOLUCION: en frio -> contactado -> interesado -> caliente -> cliente */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Evolución de los clientes</h3>
          <span style={{ fontSize: 13, color: '#67756c' }}>
            {porEtapa.interesado || 0} interesados · {porEtapa.caliente || 0} calientes · {porEtapa.cliente || 0} clientes {total ? `(${Math.round(((porEtapa.cliente || 0) / total) * 100)}% de conversión)` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {ETAPAS_ORDEN.map((k, i) => {
            const x = ETAPA[k]; const n = porEtapa[k] || 0; const activo = etapaFiltro === k;
            return (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span style={{ color: '#c3ccc6' }}>→</span>}
                <button onClick={() => { setEtapaFiltro(activo ? '' : k); setVista('todos'); }}
                  title={activo ? 'Quitar filtro' : 'Ver solo los de esta etapa'}
                  style={{ background: activo ? x.c : '#fff', color: activo ? '#fff' : x.c, border: `2px solid ${x.c}`, borderRadius: 10, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>
                  {x.i} {x.l} <span style={{ fontSize: 16 }}>{n}</span>
                </button>
              </span>
            );
          })}
          {(porEtapa.descartado || 0) > 0 && (
            <button onClick={() => { setEtapaFiltro(etapaFiltro === 'descartado' ? '' : 'descartado'); setVista('todos'); }}
              style={{ marginLeft: 10, background: etapaFiltro === 'descartado' ? ETAPA.descartado.c : '#fff', color: etapaFiltro === 'descartado' ? '#fff' : ETAPA.descartado.c, border: `2px solid ${ETAPA.descartado.c}`, borderRadius: 10, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>
              ✖ Descartados {porEtapa.descartado}
            </button>
          )}
        </div>
        <p style={{ color: '#67756c', fontSize: 12, margin: '10px 0 0' }}>
          La etapa se recalcula sola con cada señal: alta por scrapeo = <b>en frío</b>; email enviado = <b>contactado</b>; follow-up = <b>en seguimiento</b>; responde o pide info = <b>interesado</b>; cita agendada, propuesta aceptada o interés alto = <b>caliente</b>; convertido = <b>cliente</b>. Pulsa una etapa para filtrar la lista.
        </p>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef2f0' }}>
          <span style={{ fontSize: 13, color: '#67756c' }}>Ver como queda el email:</span>
          <input value={emailPrueba} onChange={(e) => setEmailPrueba(e.target.value)} placeholder="tu@correo.com" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d7ddd9', fontSize: 14 }} />
          <button onClick={enviarPrueba} disabled={busy || !emailOn}>Enviar email de prueba</button>
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
            <button onClick={puntuar} disabled={busy || !lista.length} title="La IA prioriza a quién contactar primero">⭐ Puntuar leads (IA)</button>
            <button onClick={vaciarTodo} disabled={busy || !lista.length} style={{ color: '#c0392b' }}>Vaciar lista</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 0', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['todos', 'Todos', lista.length], ['sin', 'Sin contactar', lista.filter((p) => !p.estado || p.estado === 'nuevo').length], ['cont', 'Contactados', lista.filter((p) => p.estado === 'email_enviado').length], ['resp', 'Con respuesta', lista.filter((p) => p.estado === 'respondido' || p.estado === 'convertido').length]].map(([k, l, n]) => (
            <button key={k} onClick={() => { setVista(k); setEtapaFiltro(''); }} style={{ background: vista === k && !etapaFiltro ? '#0f7a39' : '#eef2f0', color: vista === k && !etapaFiltro ? '#fff' : '#374151', border: 0, borderRadius: 8, padding: '7px 12px', fontWeight: 600, cursor: 'pointer' }}>{l} ({n})</button>
          ))}
          {etapaFiltro && (
            <span style={{ fontSize: 13, color: '#67756c', display: 'flex', alignItems: 'center', gap: 6 }}>
              Filtrando por etapa: {badgeEtapa(etapaFiltro)}
              <button onClick={() => setEtapaFiltro('')} style={{ padding: '3px 9px', fontSize: 12 }}>Quitar</button>
            </span>
          )}
        </div>
        {cargando ? <p>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 10 }}>
            <thead><tr style={{ textAlign: 'left', color: '#67756c', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: 8 }}><input type="checkbox" checked={filtrada.length > 0 && filtrada.every((p) => marcados.has(p.id))} onChange={toggleTodos} title="Seleccionar los visibles" /></th>
              <th>Negocio</th><th>Email</th><th>Situacion</th><th>Email IA</th><th>Evolucion</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {[...filtrada].sort((a, b) => ordP(b.prioridad) - ordP(a.prioridad)).map((p) => {
                const e = PESTADO[p.estado] || PESTADO.nuevo;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #eef2f0', background: marcados.has(p.id) ? '#fef4f4' : undefined }}>
                    <td style={{ padding: 8 }}><input type="checkbox" checked={marcados.has(p.id)} onChange={() => toggleMarcado(p.id)} /></td>
                    <td style={{ padding: 8 }}><b>{p.empresa || p.nombre || '-'}</b>{p.prioridad ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: PRIO[p.prioridad] || '#94a3b8', borderRadius: 20, padding: '1px 7px' }}>{p.prioridad}</span> : null}{p.interes_grado ? <span title="Interés detectado por la IA en su respuesta" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: p.interes_grado === 'alto' ? '#16a34a' : p.interes_grado === 'medio' ? '#b8860b' : '#94a3b8', borderRadius: 20, padding: '1px 7px' }}>★ {p.interes_grado}</span> : null}<br /><span style={{ color: '#67756c' }}>{p.sector}{p.ciudad ? ' - ' + p.ciudad : ''}</span></td>
                    <td>{p.email || <span style={{ color: '#94a3b8' }}>sin email</span>}</td>
                    <td>{p.situacion === 'mejorable' ? 'Mejorable' : 'Sin presencia'}</td>
                    <td style={{ textAlign: 'center' }}>{p.email_borrador ? 'Si' : '-'}</td>
                    <td>{badgeEtapa(etapaDe(p))}</td>
                    <td><span style={{ color: e.c, fontWeight: 600 }}>{e.l}</span></td>
                    <td><button onClick={() => setSel(p)} style={{ padding: '6px 12px', fontSize: 13 }}>Abrir</button></td>
                  </tr>
                );
              })}
              {!lista.length
                ? <tr><td colSpan={8} style={{ padding: 12, color: '#67756c' }}>Aun no hay prospectos. Activa el agente de captacion, sube un CSV o anade uno arriba.</td></tr>
                : !filtrada.length && <tr><td colSpan={8} style={{ padding: 12, color: '#67756c' }}>Ningun prospecto en este filtro. Prueba otra pestana o quita el filtro de etapa.</td></tr>}
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
  const [eventos, setEventos] = useState(null); // historial de evolucion del lead
  const navigate = useNavigate();
  const set = (k, v) => setP({ ...p, [k]: v });

  useEffect(() => {
    api.prospectoEventos(prospecto.id).then((r) => setEventos(r.eventos || [])).catch(() => setEventos([]));
  }, [prospecto.id]);

  async function convertir() {
    if (!nif.trim()) { alert('El NIF/CIF es obligatorio para crear el cliente.'); return; }
    if (!confirm('Crear el cliente "' + (p.empresa || p.nombre || '') + '" en el sistema?')) return;
    setBusy(true);
    try {
      await api.prospectoActualizar(p); // guarda las ediciones del modal antes de convertir
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
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Prospecto: {p.empresa || p.nombre || 'Sin nombre'} {badgeEtapa(p.etapa && ETAPA[p.etapa] ? p.etapa : 'frio')}</h3>
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

      <SeccionPropuesta prospecto={p} emailOn={emailOn} iaOn={iaOn} />

      {/* Evolucion del lead: historial de eventos (alta, emails, interes, cambios de etapa) */}
      <div style={{ background: '#f7f9fb', border: '1px solid #e3e8ef', borderRadius: 10, padding: 14, marginTop: 14 }}>
        <b>📈 Evolución del prospecto</b>
        {eventos === null ? (
          <p style={{ color: '#67756c', fontSize: 13, margin: '6px 0 0' }}>Cargando historial...</p>
        ) : eventos.length === 0 ? (
          <p style={{ color: '#67756c', fontSize: 13, margin: '6px 0 0' }}>Sin eventos todavía. Se irán registrando el alta, los emails, el interés y cada cambio de etapa.</p>
        ) : (
          <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eventos.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '5px 8px', background: '#fff', border: '1px solid #e9edf2', borderRadius: 8, alignItems: 'baseline' }}>
                <span>{EVENTO_ICONO[ev.tipo] || '·'}</span>
                <span style={{ flex: 1 }}>{ev.detalle || ev.tipo}</span>
                <span style={{ color: '#94a3b8', fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtFecha(ev.creado_en)}</span>
              </div>
            ))}
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

const PROP_EST = {
  borrador: { l: 'Borrador', c: '#94a3b8' }, enviada: { l: 'Enviada', c: '#2563eb' }, vista: { l: 'Vista', c: '#0c7b6d' },
  aceptada: { l: 'Aceptada', c: '#16a34a' }, rechazada: { l: 'Rechazada', c: '#c0392b' }, caducada: { l: 'Caducada', c: '#b8860b' },
};
const fmtEur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const PROP_BASE = (typeof window !== 'undefined' ? window.location.origin : '');

// Sección de PROPUESTA dentro del detalle del prospecto: generar (IA) / editar / enviar / ver estado.
function SeccionPropuesta({ prospecto, emailOn, iaOn }) {
  const [lista, setLista] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ intro: '', problema: '', solucion: '', plazo: '', descuento: 0, validez_dias: 15, notas: '' });

  useEffect(() => { cargar(); }, []);
  async function cargar() { try { const r = await api.propuestasList(prospecto.id); setLista(r.propuestas || []); } catch { setLista([]); } }
  function abrir(pr) { setEdit(pr); setItems(pr.items_json || []); setMeta({ intro: pr.intro || '', problema: pr.problema || '', solucion: pr.solucion || '', plazo: pr.plazo || '', descuento: Number(pr.descuento || 0), validez_dias: pr.validez_dias || 15, notas: pr.notas || '' }); }
  async function generarIA() { setBusy(true); try { const row = await api.propuestaGenerarIA(prospecto.id); await cargar(); abrir(row); } catch (e) { alert('Error: ' + e.message); } finally { setBusy(false); } }
  async function crearVacia() { setBusy(true); try { const row = await api.propuestaCrear(prospecto.id); await cargar(); abrir(row); } catch (e) { alert('Error: ' + e.message); } finally { setBusy(false); } }

  const subtotal = items.reduce((s, it) => s + Number(it.precio || 0) * Number(it.cantidad || 1), 0);
  const total = Math.max(0, subtotal - Number(meta.descuento || 0));
  const setItem = (i, k, v) => setItems(items.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const payload = () => ({ id: edit.id, intro: meta.intro, problema: meta.problema, solucion: meta.solucion, plazo: meta.plazo, descuento: Number(meta.descuento || 0), validez_dias: Number(meta.validez_dias || 15), notas: meta.notas, items: items.map((it) => ({ servicio_id: it.servicio_id, nombre: it.nombre, descripcion: it.descripcion || '', cantidad: Number(it.cantidad || 1), precio: Number(it.precio || 0), subtotal: Number(it.precio || 0) * Number(it.cantidad || 1) })) });

  async function guardar(aviso = true) { setBusy(true); try { const row = await api.propuestaUpdate(payload()); await cargar(); setEdit(row); if (aviso) alert('Propuesta guardada ✓'); return row; } catch (e) { alert('Error: ' + e.message); } finally { setBusy(false); } }
  async function enviar() {
    if (!emailOn) { alert('Email no configurado (RESEND).'); return; }
    if (!prospecto.email) { alert('El prospecto no tiene email. Añádelo arriba y guarda.'); return; }
    if (!items.length) { alert('Añade al menos una línea a la propuesta.'); return; }
    if (!confirm('Enviar la propuesta a ' + prospecto.email + '?')) return;
    setBusy(true);
    try { await api.propuestaUpdate(payload()); const row = await api.propuestaEnviar(edit.id, prospecto.email); await cargar(); setEdit(row); alert('Propuesta enviada ✓'); }
    catch (e) { alert('Error: ' + e.message); } finally { setBusy(false); }
  }
  async function borrar(pr) { if (!confirm('Borrar esta propuesta?')) return; try { await api.propuestaDelete(pr.id); if (edit && edit.id === pr.id) setEdit(null); await cargar(); } catch (e) { alert('Error: ' + e.message); } }
  function copiarEnlace(pr) { const url = PROP_BASE + '/propuesta/' + pr.token; navigator.clipboard?.writeText(url); alert('Enlace copiado:\n' + url); }

  const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d7ddd9', fontSize: 14, boxSizing: 'border-box' };
  const badge = (e) => { const x = PROP_EST[e] || PROP_EST.borrador; return <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: x.c, borderRadius: 20, padding: '2px 9px' }}>{x.l}</span>; };

  return (
    <div style={{ background: '#faf8f3', border: '1px solid #ece7da', borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b>Propuesta comercial</b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={generarIA} disabled={busy || !iaOn} style={{ background: '#5b3fa0', color: '#fff' }}>✨ Generar con IA</button>
          <button onClick={crearVacia} disabled={busy}>+ Vacía</button>
        </div>
      </div>
      <p style={{ color: '#67756c', fontSize: 12.5, margin: '4px 0 0' }}>Oferta de servicios con precio. Se envía por email y el cliente la acepta con su nombre (queda registrada con fecha e IP).</p>

      {/* Lista de propuestas existentes */}
      {lista && lista.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.map((pr) => (
            <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid #ece7da', borderRadius: 8, background: '#fff' }}>
              <b style={{ fontSize: 13 }}>{pr.numero}</b>{badge(pr.estado)}
              <span style={{ fontWeight: 700 }}>{fmtEur(pr.total)}</span>
              {pr.estado === 'aceptada' && pr.acept_nombre && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ {pr.acept_nombre}</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => abrir(pr)} style={{ fontSize: 12, padding: '4px 10px' }}>Editar</button>
                {pr.token && <button onClick={() => copiarEnlace(pr)} style={{ fontSize: 12, padding: '4px 10px' }}>Enlace</button>}
                <button onClick={() => borrar(pr)} style={{ fontSize: 12, padding: '4px 10px', color: '#c0392b' }}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor de la propuesta abierta */}
      {edit && (
        <div style={{ marginTop: 12, borderTop: '1px solid #ece7da', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Editar {edit.numero} {badge(edit.estado)}</b>
            <button onClick={() => setEdit(null)} style={{ fontSize: 12, padding: '4px 10px' }}>Cerrar editor</button>
          </div>
          <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>Introducción
            <textarea value={meta.intro} onChange={(e) => setMeta({ ...meta, intro: e.target.value })} style={{ ...inp, minHeight: 60 }} placeholder="Texto personalizado para el cliente" />
          </label>
          {/* Diagnostico humanizado: se genera con la IA a partir del problema del negocio, editable */}
          <div style={{ background: '#fff', border: '1px solid #ece7da', borderRadius: 8, padding: 10, margin: '10px 0' }}>
            <div style={{ fontSize: 12.5, color: '#67756c', marginBottom: 6 }}>Propuesta humanizada (se rellena con "Generar con IA" según el problema del negocio; edítalo si quieres):</div>
            <label style={{ display: 'block', fontSize: 13 }}>🔶 El problema que ves en su negocio
              <textarea value={meta.problema} onChange={(e) => setMeta({ ...meta, problema: e.target.value })} style={{ ...inp, minHeight: 44 }} placeholder="Ej: no apareces en Google cuando buscan tu servicio en tu zona" />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginTop: 6 }}>🟢 Cómo lo resolvéis
              <textarea value={meta.solucion} onChange={(e) => setMeta({ ...meta, solucion: e.target.value })} style={{ ...inp, minHeight: 44 }} placeholder="Ej: ponemos al día tu ficha y tu web con las palabras que busca tu cliente" />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginTop: 6 }}>🟣 En cuánto tiempo (plazo según el problema)
              <input value={meta.plazo} onChange={(e) => setMeta({ ...meta, plazo: e.target.value })} style={inp} placeholder="Ej: unas 4 a 6 semanas" />
            </label>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, margin: '10px 0 4px' }}>Líneas</div>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input value={it.nombre || ''} onChange={(e) => setItem(i, 'nombre', e.target.value)} placeholder="Servicio" style={inp} />
              <input type="number" min="1" value={it.cantidad || 1} onChange={(e) => setItem(i, 'cantidad', e.target.value)} style={inp} />
              <input type="number" min="0" step="0.01" value={it.precio || 0} onChange={(e) => setItem(i, 'precio', e.target.value)} style={inp} />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ color: '#c0392b', padding: 4 }}>×</button>
            </div>
          ))}
          <button onClick={() => setItems([...items, { nombre: '', descripcion: '', cantidad: 1, precio: 0 }])} style={{ fontSize: 12, padding: '4px 10px' }}>+ Añadir línea</button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>Descuento €<input type="number" min="0" step="0.01" value={meta.descuento} onChange={(e) => setMeta({ ...meta, descuento: e.target.value })} style={{ ...inp, width: 100 }} /></label>
            <label style={{ fontSize: 13 }}>Validez (días)<input type="number" min="1" value={meta.validez_dias} onChange={(e) => setMeta({ ...meta, validez_dias: e.target.value })} style={{ ...inp, width: 90 }} /></label>
            <div style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 800 }}>Total: {fmtEur(total)}</div>
          </div>
          <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>Condiciones / forma de pago (opcional)
            <textarea value={meta.notas} onChange={(e) => setMeta({ ...meta, notas: e.target.value })} style={{ ...inp, minHeight: 50 }} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button onClick={() => guardar(true)} disabled={busy}>Guardar</button>
            <button onClick={enviar} disabled={busy || !emailOn} style={{ background: '#0c7b6d', color: '#fff' }}>Enviar al cliente</button>
            {edit.token && <button onClick={() => copiarEnlace(edit)}>Copiar enlace</button>}
          </div>
          {edit.estado === 'aceptada' && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 8 }}>✓ Aceptada por <b>{edit.acept_nombre}</b> el {String(edit.aceptada_en || '').slice(0, 16).replace('T', ' ')} (IP {edit.acept_ip}). Ya puedes convertirlo en cliente arriba.</p>}
        </div>
      )}
    </div>
  );
}
