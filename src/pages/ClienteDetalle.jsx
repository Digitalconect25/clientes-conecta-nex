import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros, generarPorTipo, TIPOS_DOC } from '../lib/contratos.js';
import FirmaCanvas from '../components/FirmaCanvas.jsx';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';

const ESTADOS = ['Pendiente firma', 'Firmado', 'En curso', 'Entregado', 'Cancelado'];
const ESTADOS_PROYECTO = ['Sin iniciar', 'En proceso', 'Pausado', 'Finalizado', 'Entregado y aceptado'];
const FORMAS_PAGO = [
  '50% al inicio, 50% a la entrega',
  '30% al inicio, 70% a la entrega',
  '100% al inicio',
  '100% a la entrega',
  'Cuota mensual recurrente',
];

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [emisor, setEmisor] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [pestana, setPestana] = useState('datos');
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [showFirma, setShowFirma] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [pagoEditando, setPagoEditando] = useState(null);

  useEffect(() => { cargarTodo(); }, [id]);

  async function cargarTodo() {
    setCargando(true);
    try {
      const [c, e, s, ar, doc, pgs] = await Promise.all([
        api.clienteGet(id), api.emisorGet(), api.serviciosList(),
        api.archivosList(id), api.documentosList(id), api.pagosList(id),
      ]);
      setCliente(c); setBorrador(c); setEmisor(e); setServicios(s);
      setArchivos(ar); setDocumentos(doc); setPagos(pgs);
    } catch (err) {
      alert('Error al cargar: ' + err.message);
      navigate('/clientes');
    } finally { setCargando(false); }
  }

  function set(k, v) { setBorrador((d) => ({ ...d, [k]: v })); }

  function setServicio(idx, campo, valor) {
    const sx = [...(borrador.servicios_json || [])];
    sx[idx] = { ...sx[idx], [campo]: valor };
    if (campo === 'nombre') {
      const cat = servicios.find((s) => s.nombre === valor);
      if (cat) sx[idx].precio = parseFloat(cat.precio);
    }
    set('servicios_json', sx);
  }

  function anadirServicio() {
    const sx = [...(borrador.servicios_json || []), { nombre: '', cantidad: 1, precio: 0 }];
    if (sx.length > 5) return;
    set('servicios_json', sx);
  }

  function quitarServicio(idx) {
    const sx = (borrador.servicios_json || []).filter((_, i) => i !== idx);
    set('servicios_json', sx);
  }

  async function guardar() {
    try {
      const actualizado = await api.clienteUpdate(borrador);
      setCliente(actualizado); setBorrador(actualizado); setEditando(false);
    } catch (err) { alert('Error al guardar: ' + err.message); }
  }

  async function borrar() {
    if (!confirm(`Borrar el cliente "${cliente.nombre}"? No se puede deshacer.`)) return;
    try { await api.clienteDelete(cliente.id); navigate('/clientes'); }
    catch (err) { alert('Error: ' + err.message); }
  }

  async function generarNumeroContrato() {
    try {
      const actualizado = await api.clienteUpdate({ ...borrador, generar_contrato: true });
      setCliente(actualizado); setBorrador(actualizado);
      const pgs = await api.pagosList(cliente.id);
      setPagos(pgs);
      alert('Numero de contrato asignado: ' + actualizado.numero_contrato + '\n\nSe han generado automaticamente las cuotas de pago en la pestana Pagos.');
    } catch (err) { alert('Error: ' + err.message); }
  }

  function abrirPreview(tipo) {
    if (!cliente.servicios_json || cliente.servicios_json.length === 0) {
      alert('Anade servicios al cliente antes de generar el documento.');
      return;
    }
    if (!emisor.nif || emisor.nif.length < 5) {
      alert('Antes rellena tu NIF en Mis datos.');
      return;
    }
    const html = generarPorTipo(tipo, cliente, emisor, cliente.firma_cliente);
    setPreviewDoc({ tipo, html });
  }

  async function descargarPDF(tipo, htmlOverride) {
    const html = htmlOverride || generarPorTipo(tipo, cliente, emisor, cliente.firma_cliente);
    const tipoNombre = TIPOS_DOC.find((t) => t.id === tipo)?.nombre || tipo;
    const numero = cliente.numero_contrato || cliente.numero_cliente;
    const filename = `${numero} - ${tipoNombre} - ${cliente.nombre}.pdf`;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    try {
      await html2pdf().set({
        margin: [10, 10, 10, 10], filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(div).save();

      await api.documentoCreate({
        cliente_id: cliente.id, tipo, nombre: filename, contenido_html: html,
      });
      const docs = await api.documentosList(cliente.id);
      setDocumentos(docs);
    } finally { div.remove(); }
  }

  function imprimirDocumento(html) {
    const w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueo la ventana de impresion. Permite popups.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  }

  async function descargarTodosZip() {
    if (!cliente.servicios_json || cliente.servicios_json.length === 0) {
      alert('Anade servicios al cliente antes de generar los documentos.');
      return;
    }
    if (!emisor.nif || emisor.nif.length < 5) {
      alert('Antes rellena tu NIF en Mis datos.');
      return;
    }
    const zip = new JSZip();
    for (const t of TIPOS_DOC) {
      const html = generarPorTipo(t.id, cliente, emisor, cliente.firma_cliente);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      try {
        const pdf = await html2pdf().set({
          margin: [10, 10, 10, 10],
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        }).from(tmp).output('blob');
        const numero = cliente.numero_contrato || cliente.numero_cliente;
        zip.file(`${numero} - ${t.nombre} - ${cliente.nombre}.pdf`, pdf);
      } finally { tmp.remove(); }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cliente.numero_contrato || cliente.numero_cliente} - ${cliente.nombre} - Documentos.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFirmar(dataURL) {
    try {
      const actualizado = await api.clienteUpdate({
        ...cliente, firma_cliente: dataURL,
        fecha_firma: new Date().toISOString(), estado: 'Firmado',
      });
      setCliente(actualizado); setBorrador(actualizado); setShowFirma(false);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function subirArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('Archivo demasiado grande (max 8 MB)'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        await api.archivoUpload({
          cliente_id: cliente.id, nombre: file.name,
          tipo: file.type || 'application/octet-stream', contenido_base64: base64,
        });
        const ar = await api.archivosList(cliente.id);
        setArchivos(ar);
      } catch (err) { alert('Error: ' + err.message); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function borrarArchivo(idArchivo) {
    if (!confirm('Borrar este archivo?')) return;
    await api.archivoDelete(idArchivo);
    setArchivos(archivos.filter((a) => a.id !== idArchivo));
  }

  async function borrarDocumento(idDoc) {
    if (!confirm('Borrar este documento?')) return;
    await api.documentoDelete(idDoc);
    setDocumentos(documentos.filter((d) => d.id !== idDoc));
  }

  async function guardarPago(p) {
    try {
      if (p.id) await api.pagoUpdate(p);
      else await api.pagoCreate({ ...p, cliente_id: cliente.id });
      const pgs = await api.pagosList(cliente.id);
      setPagos(pgs);
      setPagoEditando(null);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function borrarPago(idPago) {
    if (!confirm('Borrar este pago?')) return;
    await api.pagoDelete(idPago);
    setPagos(pagos.filter(p => p.id !== idPago));
  }

  async function marcarCobrado(p) {
    const hoy = new Date().toISOString().split('T')[0];
    await api.pagoUpdate({ ...p, estado: 'Cobrado', fecha_pago: hoy });
    const pgs = await api.pagosList(cliente.id);
    setPagos(pgs);
  }

  if (cargando) return <div className="empty">Cargando...</div>;
  if (!cliente) return <div className="empty">No encontrado</div>;

  const c = editando ? borrador : cliente;
  const totales = calcularTotales(c);
  const totalCobrado = pagos.filter(p => p.estado === 'Cobrado').reduce((s, p) => s + Number(p.importe), 0);
  const totalPendiente = pagos.filter(p => p.estado === 'Pendiente').reduce((s, p) => s + Number(p.importe), 0);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const pagosVencidos = pagos.filter(p => p.estado === 'Pendiente' && p.fecha_esperada && new Date(p.fecha_esperada) < hoy);
  const importeVencido = pagosVencidos.reduce((s, p) => s + Number(p.importe), 0);

  return (
    <div>
      <div className="main-header">
        <div>
          <button className="btn-outline btn-sm" onClick={() => navigate('/clientes')} style={{ marginBottom: 8 }}>← Clientes</button>
          <h1>{cliente.nombre}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
            <code style={{ background: '#f3f4f6', padding: '3px 8px', borderRadius: 4, fontSize: 12, color: '#374151' }}>{cliente.numero_cliente}</code>
            {cliente.numero_contrato && <code style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontSize: 12 }}>{cliente.numero_contrato}</code>}
            <span className={`estado ${claseEstado(cliente.estado)}`}>{cliente.estado}</span>
            {cliente.estado_proyecto && <span className="estado" style={{ background: '#e0e7ff', color: '#3730a3' }}>{cliente.estado_proyecto}{cliente.porcentaje_avance > 0 ? ` ${cliente.porcentaje_avance}%` : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editando ? (
            <>
              <button className="btn-outline" onClick={() => setEditando(true)}>Editar</button>
              <button className="btn-danger" onClick={borrar}>Borrar</button>
            </>
          ) : (
            <>
              <button className="btn-outline" onClick={() => { setEditando(false); setBorrador(cliente); }}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar cambios</button>
            </>
          )}
        </div>
      </div>

      {pagosVencidos.length > 0 && (
        <div className="alerta alerta-error" style={{ marginBottom: 15 }}>
          <strong>Atencion:</strong> este cliente tiene {pagosVencidos.length} pago(s) vencido(s) por un total de {fmtEuros(importeVencido)}. Revisa la pestana Pagos.
        </div>
      )}

      <div className="cliente-detalle-tabs">
        <button className={pestana === 'datos' ? 'active' : ''} onClick={() => setPestana('datos')}>Datos</button>
        <button className={pestana === 'servicios' ? 'active' : ''} onClick={() => setPestana('servicios')}>Servicios</button>
        <button className={pestana === 'proyecto' ? 'active' : ''} onClick={() => setPestana('proyecto')}>Proyecto</button>
        <button className={pestana === 'pagos' ? 'active' : ''} onClick={() => setPestana('pagos')}>Pagos ({pagos.length})</button>
        <button className={pestana === 'documentos' ? 'active' : ''} onClick={() => setPestana('documentos')}>Documentos ({documentos.length})</button>
        <button className={pestana === 'archivos' ? 'active' : ''} onClick={() => setPestana('archivos')}>Archivos ({archivos.length})</button>
      </div>

      {pestana === 'datos' && (
        <div className="card">
          <h2>Datos del cliente</h2>
          <div className="grid">
            <div><label>Tipo de persona</label>{editando ? <select value={c.tipo_persona} onChange={(e) => set('tipo_persona', e.target.value)}><option>Fisica</option><option>Juridica</option></select> : <div>{c.tipo_persona}</div>}</div>
            <div><label>Estado contrato</label>{editando ? <select value={c.estado} onChange={(e) => set('estado', e.target.value)}>{ESTADOS.map((e) => <option key={e}>{e}</option>)}</select> : <div><span className={`estado ${claseEstado(c.estado)}`}>{c.estado}</span></div>}</div>
            <div style={{ gridColumn: 'span 2' }}><label>Nombre / Razon social</label>{editando ? <input value={c.nombre} onChange={(e) => set('nombre', e.target.value)} /> : <div>{c.nombre}</div>}</div>
            <div><label>{c.tipo_persona === 'Juridica' ? 'CIF' : 'NIF'}</label>{editando ? <input value={c.nif} onChange={(e) => set('nif', e.target.value.toUpperCase())} /> : <div>{c.nif}</div>}</div>
            <div><label>Persona contacto</label>{editando ? <input value={c.contacto || ''} onChange={(e) => set('contacto', e.target.value)} /> : <div>{c.contacto || '-'}</div>}</div>
            <div style={{ gridColumn: 'span 2' }}><label>Direccion</label>{editando ? <input value={c.direccion || ''} onChange={(e) => set('direccion', e.target.value)} /> : <div>{c.direccion || '-'}</div>}</div>
            <div><label>CP</label>{editando ? <input value={c.cp || ''} onChange={(e) => set('cp', e.target.value)} /> : <div>{c.cp || '-'}</div>}</div>
            <div><label>Ciudad</label>{editando ? <input value={c.ciudad || ''} onChange={(e) => set('ciudad', e.target.value)} /> : <div>{c.ciudad || '-'}</div>}</div>
            <div><label>Provincia</label>{editando ? <input value={c.provincia || ''} onChange={(e) => set('provincia', e.target.value)} /> : <div>{c.provincia || '-'}</div>}</div>
            <div><label>Pais</label>{editando ? <input value={c.pais || ''} onChange={(e) => set('pais', e.target.value)} /> : <div>{c.pais || '-'}</div>}</div>
            <div><label>Email</label>{editando ? <input type="email" value={c.email || ''} onChange={(e) => set('email', e.target.value)} /> : <div>{c.email || '-'}</div>}</div>
            <div><label>Telefono</label>{editando ? <input value={c.telefono || ''} onChange={(e) => set('telefono', e.target.value)} /> : <div>{c.telefono || '-'}</div>}</div>
          </div>
        </div>
      )}

      {pestana === 'servicios' && (
        <div className="card">
          <h2>Servicios contratados</h2>
          {editando && <button className="btn-primary btn-sm" onClick={anadirServicio} style={{ marginBottom: 15 }}>+ Anadir servicio</button>}
          {(c.servicios_json || []).length === 0 ? (
            <div className="empty"><p>Sin servicios. {editando && 'Pulsa "Anadir servicio" para empezar.'}</p></div>
          ) : (c.servicios_json || []).map((s, idx) => (
            <div key={idx} className="servicio-row">
              <div><label>Servicio</label>{editando ? (
                <select value={s.nombre || ''} onChange={(e) => setServicio(idx, 'nombre', e.target.value)}>
                  <option value="">Selecciona</option>
                  {servicios.map((sv) => <option key={sv.id} value={sv.nombre}>{sv.nombre} ({fmtEuros(sv.precio)})</option>)}
                </select>
              ) : <div>{s.nombre || '-'}</div>}</div>
              <div><label>Cantidad</label>{editando ? <input type="number" min="1" value={s.cantidad} onChange={(e) => setServicio(idx, 'cantidad', parseFloat(e.target.value) || 0)} /> : <div>{s.cantidad}</div>}</div>
              <div><label>Precio</label>{editando ? <input type="number" step="0.01" value={s.precio} onChange={(e) => setServicio(idx, 'precio', parseFloat(e.target.value) || 0)} /> : <div>{fmtEuros(s.precio)}</div>}</div>
              <div>{editando && <button className="btn-danger btn-sm" onClick={() => quitarServicio(idx)}>X</button>}</div>
            </div>
          ))}

          <h2 style={{ marginTop: 25 }}>Detalles del proyecto</h2>
          <div className="grid">
            <div style={{ gridColumn: 'span 2' }}><label>Descripcion del proyecto</label>{editando ? <textarea rows="3" value={c.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} /> : <div>{c.descripcion || '-'}</div>}</div>
            <div><label>Plazo de entrega</label>{editando ? <input value={c.plazo || ''} onChange={(e) => set('plazo', e.target.value)} placeholder="Ej: 15 dias laborables" /> : <div>{c.plazo || '-'}</div>}</div>
            <div><label>IVA %</label>{editando ? <input type="number" value={c.iva} onChange={(e) => set('iva', parseFloat(e.target.value) || 0)} /> : <div>{c.iva}%</div>}</div>
            <div style={{ gridColumn: 'span 2' }}><label>Forma de pago</label>{editando ? <select value={c.forma_pago} onChange={(e) => set('forma_pago', e.target.value)}>{FORMAS_PAGO.map((fp) => <option key={fp}>{fp}</option>)}</select> : <div>{c.forma_pago}</div>}</div>
            <div style={{ gridColumn: 'span 2' }}><label>Notas internas</label>{editando ? <textarea rows="2" value={c.notas || ''} onChange={(e) => set('notas', e.target.value)} /> : <div>{c.notas || '-'}</div>}</div>
          </div>

          <div className="totales">
            <div className="totales-grid">
              <div><div className="label">Base imponible</div><div className="valor">{fmtEuros(totales.base)}</div></div>
              <div><div className="label">IVA ({c.iva}%)</div><div className="valor">{fmtEuros(totales.iva)}</div></div>
              <div><div className="label">TOTAL</div><div className="valor total">{fmtEuros(totales.total)}</div></div>
            </div>
          </div>
        </div>
      )}

      {pestana === 'proyecto' && (
        <div className="card">
          <h2>Estado del proyecto</h2>
          <div className="grid">
            <div>
              <label>Estado</label>
              {editando ? <select value={c.estado_proyecto || 'Sin iniciar'} onChange={(e) => set('estado_proyecto', e.target.value)}>{ESTADOS_PROYECTO.map(e => <option key={e}>{e}</option>)}</select> : <div>{c.estado_proyecto || 'Sin iniciar'}</div>}
            </div>
            <div>
              <label>Avance ({c.porcentaje_avance || 0}%)</label>
              {editando ? <input type="range" min="0" max="100" step="5" value={c.porcentaje_avance || 0} onChange={(e) => set('porcentaje_avance', parseInt(e.target.value, 10))} /> : (
                <div style={{ background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', height: 24 }}>
                  <div style={{ background: '#047857', width: (c.porcentaje_avance || 0) + '%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}>{c.porcentaje_avance || 0}%</div>
                </div>
              )}
            </div>
            <div>
              <label>Fecha de inicio</label>
              {editando ? <input type="date" value={c.fecha_inicio ? c.fecha_inicio.split('T')[0] : ''} onChange={(e) => set('fecha_inicio', e.target.value || null)} /> : <div>{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-ES') : '-'}</div>}
            </div>
            <div>
              <label>Fecha fin prevista</label>
              {editando ? <input type="date" value={c.fecha_fin_prevista ? c.fecha_fin_prevista.split('T')[0] : ''} onChange={(e) => set('fecha_fin_prevista', e.target.value || null)} /> : <div>{c.fecha_fin_prevista ? new Date(c.fecha_fin_prevista).toLocaleDateString('es-ES') : '-'}</div>}
            </div>
            <div>
              <label>Fecha fin real</label>
              {editando ? <input type="date" value={c.fecha_fin_real ? c.fecha_fin_real.split('T')[0] : ''} onChange={(e) => set('fecha_fin_real', e.target.value || null)} /> : <div>{c.fecha_fin_real ? new Date(c.fecha_fin_real).toLocaleDateString('es-ES') : '-'}</div>}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Notas del proyecto (uso interno)</label>
              {editando ? <textarea rows="4" value={c.notas_proyecto || ''} onChange={(e) => set('notas_proyecto', e.target.value)} placeholder="Apuntes, recordatorios, lo que necesites" /> : <div style={{ whiteSpace: 'pre-wrap' }}>{c.notas_proyecto || '-'}</div>}
            </div>
          </div>
        </div>
      )}

      {pestana === 'pagos' && (
        <div>
          <div className="card">
            <h2>Resumen economico</h2>
            <div className="totales">
              <div className="totales-grid">
                <div><div className="label">Total contratado</div><div className="valor">{fmtEuros(cliente.total)}</div></div>
                <div><div className="label">Cobrado</div><div className="valor" style={{ color: '#047857' }}>{fmtEuros(totalCobrado)}</div></div>
                <div><div className="label">Pendiente</div><div className="valor" style={{ color: importeVencido > 0 ? '#dc2626' : '#92400e' }}>{fmtEuros(totalPendiente)}</div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h2 style={{ border: 'none', margin: 0 }}>Pagos del cliente</h2>
              <button className="btn-primary btn-sm" onClick={() => setPagoEditando({ concepto: '', importe: 0, fecha_esperada: '', estado: 'Pendiente', metodo: 'Transferencia' })}>+ Nuevo pago</button>
            </div>
            {pagos.length === 0 ? (
              <div className="empty">
                <p>No hay pagos todavia.</p>
                <p style={{ fontSize: 12, marginTop: 10 }}>Cuando generes el numero de contrato (en pestana Documentos), se generaran automaticamente los pagos segun la forma de pago elegida.</p>
              </div>
            ) : (
              <table>
                <thead><tr><th>Concepto</th><th>Importe</th><th>Fecha esperada</th><th>Fecha pago</th><th>Estado</th><th>Metodo</th><th></th></tr></thead>
                <tbody>
                  {pagos.map((p) => {
                    const vencido = p.estado === 'Pendiente' && p.fecha_esperada && new Date(p.fecha_esperada) < hoy;
                    return (
                      <tr key={p.id} style={vencido ? { background: '#fef2f2' } : {}}>
                        <td>{p.concepto}{p.es_recurrente && <span style={{ marginLeft: 6, fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 8 }}>Recurrente</span>}</td>
                        <td style={{ fontWeight: 600 }}>{fmtEuros(p.importe)}</td>
                        <td style={{ fontSize: 12 }}>{p.fecha_esperada ? new Date(p.fecha_esperada).toLocaleDateString('es-ES') : '-'}</td>
                        <td style={{ fontSize: 12 }}>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-ES') : '-'}</td>
                        <td><span className={`estado ${p.estado === 'Cobrado' ? 'estado-firmado' : p.estado === 'Cancelado' ? 'estado-cancelado' : vencido ? 'estado-cancelado' : 'estado-pendiente'}`}>{vencido ? 'Vencido' : p.estado}</span></td>
                        <td style={{ fontSize: 12 }}>{p.metodo}</td>
                        <td>
                          {p.estado === 'Pendiente' && <button className="btn-primary btn-sm" onClick={() => marcarCobrado(p)}>Cobrado</button>}{' '}
                          <button className="btn-outline btn-sm" onClick={() => setPagoEditando(p)}>Editar</button>{' '}
                          <button className="btn-danger btn-sm" onClick={() => borrarPago(p.id)}>X</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {pestana === 'documentos' && (
        <div>
          <div className="card">
            <h2>Generar documentos</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 15 }}>
              Pulsa cualquier boton para previsualizar el documento ya rellenado. Despues podras imprimirlo o descargarlo en PDF.
            </p>
            {!cliente.numero_contrato && (
              <div className="alerta alerta-aviso">
                Aun no tienes numero de contrato. <button onClick={generarNumeroContrato} className="btn-sm btn-primary" style={{ marginLeft: 10 }}>Generar numero ahora</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {TIPOS_DOC.map((t) => <button key={t.id} className="btn-primary" onClick={() => abrirPreview(t.id)}>{t.nombre}</button>)}
              <button className="btn-outline" onClick={descargarTodosZip}>Descargar TODOS en ZIP</button>
              <button className="btn-outline" onClick={() => setShowFirma(true)}>{cliente.firma_cliente ? 'Cambiar firma' : 'Anadir firma del cliente'}</button>
            </div>
          </div>

          {cliente.firma_cliente && (
            <div className="card">
              <h2>Firma del cliente</h2>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Firmado el {new Date(cliente.fecha_firma).toLocaleString('es-ES')}</p>
              <img src={cliente.firma_cliente} alt="Firma" style={{ maxWidth: 300, border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 10 }} />
            </div>
          )}

          <div className="card">
            <h2>Documentos generados ({documentos.length})</h2>
            {documentos.length === 0 ? (
              <div className="empty"><p>Aun no has generado ningun documento.</p></div>
            ) : (
              <table>
                <thead><tr><th>Documento</th><th>Tipo</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id}>
                      <td>{d.nombre}</td>
                      <td>{TIPOS_DOC.find((t) => t.id === d.tipo)?.nombre || d.tipo}</td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(d.creado_en).toLocaleString('es-ES')}</td>
                      <td>
                        <button className="btn-outline btn-sm" onClick={() => descargarPDF(d.tipo)}>Re-descargar</button>{' '}
                        <button className="btn-danger btn-sm" onClick={() => borrarDocumento(d.id)}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {pestana === 'archivos' && (
        <div className="card">
          <h2>Archivos del cliente</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 15 }}>Sube aqui contratos firmados escaneados, DNI, briefings, materiales del cliente. Maximo 8 MB por archivo.</p>
          <input type="file" onChange={subirArchivo} style={{ marginBottom: 20 }} />
          {archivos.length === 0 ? (
            <div className="empty"><p>Sin archivos subidos todavia.</p></div>
          ) : (
            <table>
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamano</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {archivos.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nombre}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{a.tipo}</td>
                    <td style={{ fontSize: 12 }}>{(a.tamano / 1024).toFixed(1)} KB</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(a.creado_en).toLocaleDateString('es-ES')}</td>
                    <td>
                      <a href={api.archivoDownloadUrl(a.id)} className="btn-outline btn-sm" style={{ display: 'inline-block', textDecoration: 'none' }}>Descargar</a>{' '}
                      <button className="btn-danger btn-sm" onClick={() => borrarArchivo(a.id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showFirma && (
        <div className="modal-overlay" onClick={() => setShowFirma(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Firma del cliente</h2><button onClick={() => setShowFirma(false)}>&times;</button></div>
            <div className="modal-body"><FirmaCanvas onFirmar={handleFirmar} onCancelar={() => setShowFirma(false)} /></div>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 950 }}>
            <div className="modal-header"><h2>{TIPOS_DOC.find((t) => t.id === previewDoc.tipo)?.nombre}</h2><button onClick={() => setPreviewDoc(null)}>&times;</button></div>
            <div className="modal-body"><div dangerouslySetInnerHTML={{ __html: previewDoc.html }} /></div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setPreviewDoc(null)}>Cerrar</button>
              <button className="btn-outline" onClick={() => imprimirDocumento(previewDoc.html)}>Imprimir</button>
              <button className="btn-primary" onClick={async () => { await descargarPDF(previewDoc.tipo, previewDoc.html); setPreviewDoc(null); }}>Descargar PDF</button>
            </div>
          </div>
        </div>
      )}

      {pagoEditando && (
        <ModalPago pago={pagoEditando} onSave={guardarPago} onClose={() => setPagoEditando(null)} />
      )}
    </div>
  );
}

function ModalPago({ pago, onSave, onClose }) {
  const [d, setD] = useState({
    ...pago,
    fecha_esperada: pago.fecha_esperada ? (pago.fecha_esperada.split ? pago.fecha_esperada.split('T')[0] : pago.fecha_esperada) : '',
    fecha_pago: pago.fecha_pago ? (pago.fecha_pago.split ? pago.fecha_pago.split('T')[0] : pago.fecha_pago) : '',
  });
  function set(k, v) { setD((x) => ({ ...x, [k]: v })); }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header"><h2>{pago.id ? 'Editar pago' : 'Nuevo pago'}</h2><button onClick={onClose}>&times;</button></div>
        <div className="modal-body">
          <div className="grid">
            <div style={{ gridColumn: 'span 2' }}><label>Concepto *</label><input value={d.concepto || ''} onChange={(e) => set('concepto', e.target.value)} placeholder="Ej: Primer pago, cuota mensual abril..." /></div>
            <div><label>Importe (EUR) *</label><input type="number" step="0.01" value={d.importe || 0} onChange={(e) => set('importe', parseFloat(e.target.value) || 0)} /></div>
            <div><label>Estado</label>
              <select value={d.estado || 'Pendiente'} onChange={(e) => set('estado', e.target.value)}>
                {['Pendiente', 'Cobrado', 'Cancelado'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div><label>Fecha esperada</label><input type="date" value={d.fecha_esperada || ''} onChange={(e) => set('fecha_esperada', e.target.value)} /></div>
            <div><label>Fecha pago real</label><input type="date" value={d.fecha_pago || ''} onChange={(e) => set('fecha_pago', e.target.value)} /></div>
            <div><label>Metodo de pago</label>
              <select value={d.metodo || 'Transferencia'} onChange={(e) => set('metodo', e.target.value)}>
                {['Transferencia', 'Bizum', 'Efectivo', 'Stripe', 'PayPal', 'Otro'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label>Recurrente?</label>
              <select value={d.es_recurrente ? 'si' : 'no'} onChange={(e) => set('es_recurrente', e.target.value === 'si')}>
                <option value="no">No</option><option value="si">Si</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}><label>Notas</label><textarea rows="2" value={d.notas || ''} onChange={(e) => set('notas', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => {
            if (!d.concepto || !d.importe) { alert('Concepto e importe obligatorios'); return; }
            onSave(d);
          }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function calcularTotales(c) {
  let base = 0;
  (c.servicios_json || []).forEach((s) => {
    base += (parseFloat(s.cantidad) || 0) * (parseFloat(s.precio) || 0);
  });
  const iva = base * (parseFloat(c.iva) || 0) / 100;
  return { base, iva, total: base + iva };
}

function claseEstado(e) {
  return {
    'Pendiente firma': 'estado-pendiente',
    'Firmado': 'estado-firmado',
    'Cancelado': 'estado-cancelado',
    'En curso': 'estado-curso',
    'Entregado': 'estado-entregado',
  }[e] || 'estado-pendiente';
}
