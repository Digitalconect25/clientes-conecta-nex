import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getPassword } from '../lib/api.js';
import { fmtEuros, generarPorTipo, TIPOS_DOC } from '../lib/contratos.js';
import FirmaCanvas from '../components/FirmaCanvas.jsx';
import EmailCompositor from '../components/EmailCompositor.jsx';

const CATEGORIAS_ACCESO = [
  'Email', 'Hosting', 'Dominio', 'Web / WordPress', 'Google',
  'Redes sociales', 'Canva', 'Pasarela de pago', 'Calendly',
  'Mailchimp / Email marketing', 'IA / ChatGPT', 'ERP / CRM',
  'Telefonia / Whatsapp Business', 'Otros',
];

const ESTADOS_PROYECTO = [
  'Sin iniciar', 'En curso', 'En revision por cliente',
  'Pausado', 'Entregado y aceptado', 'Cancelado',
];

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [emisor, setEmisor] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [fases, setFases] = useState([]);
  const [accesos, setAccesos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [entregables, setEntregables] = useState([]);
  const [pestana, setPestana] = useState('datos');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    setCargando(true);
    try {
      const [c, e, s, p, f, ac, d, ar, en] = await Promise.all([
        api.clienteGet(id),
        api.emisorGet(),
        api.serviciosList(),
        api.pagosList(id),
        api.fasesList(id),
        api.accesosList(id),
        api.documentosList(id),
        api.archivosList(id),
        api.entregablesList(id),
      ]);
      setCliente(c);
      setEmisor(e);
      setServicios(s);
      setPagos(p);
      setFases(f);
      setAccesos(ac);
      setDocumentos(d);
      setArchivos(ar);
      setEntregables(en);
    } catch (err) {
      alert('Error cargando: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  // Guarda solo los campos enviados (PUT inteligente).
  // El backend mezcla con los datos actuales y NO sobreescribe campos no enviados.
  async function guardarCliente(parcial) {
    try {
      const saved = await api.clienteUpdate({ id: cliente.id, ...parcial });
      setCliente(saved);
      // Si cambia el total, recargar pagos para reflejar la propagacion
      if (parcial.servicios_json || parcial.iva || parcial.forma_pago) {
        const ps = await api.pagosList(id);
        setPagos(ps);
      }
      return saved;
    } catch (err) {
      alert('Error guardando: ' + err.message);
      throw err;
    }
  }

  async function eliminarCliente() {
    const ok1 = confirm(`Vas a eliminar al cliente "${cliente.nombre}" y TODOS sus datos: pagos, fases, accesos, documentos y archivos. Esta accion NO se puede deshacer. Continuar?`);
    if (!ok1) return;
    const respuesta = prompt(`Para confirmar, escribe el nombre del cliente exactamente como aparece: ${cliente.nombre}`);
    if (respuesta !== cliente.nombre) {
      if (respuesta !== null) alert('El nombre no coincide. Eliminacion cancelada.');
      return;
    }
    try {
      await api.clienteDelete(cliente.id);
      alert('Cliente eliminado.');
      navigate('/clientes');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (cargando || !cliente || !emisor) {
    return <div style={{ padding: 40 }}>Cargando...</div>;
  }

  return (
    <div className="cliente-detalle">
      <div className="header-cliente">
        <button onClick={() => navigate('/clientes')}>&larr; Volver</button>
        <div style={{ flex: 1, marginLeft: 16 }}>
          <h1 style={{ margin: 0 }}>{cliente.nombre}</h1>
          <div className="meta-cliente">
            <span>{cliente.numero_cliente}</span>
            {cliente.numero_contrato && <span>{cliente.numero_contrato}</span>}
            <span className={`pill estado-${(cliente.estado || '').toLowerCase().replace(/ /g, '-')}`}>{cliente.estado}</span>
            <span className="pill estado-proyecto">{cliente.estado_proyecto}</span>
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Avance del proyecto</div>
          <div className="progreso">
            <div className="progreso-barra" style={{ width: `${cliente.porcentaje_avance || 0}%` }}></div>
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{cliente.porcentaje_avance || 0}%</div>
        </div>
      </div>

      <div className="pestanas">
        {[
          ['datos', 'Datos'],
          ['servicios', 'Servicios'],
          ['pipeline', 'Pipeline'],
          ['entregables', 'Entregables'],
          ['pagos', 'Pagos'],
          ['accesos', 'Accesos'],
          ['documentos', 'Documentos'],
          ['archivos', 'Archivos'],
          ['emails', 'Emails'],
        ].map(([k, l]) => (
          <button key={k} className={`pestana ${pestana === k ? 'activa' : ''}`} onClick={() => setPestana(k)}>{l}</button>
        ))}
      </div>

      <div className="contenido-pestana">
        {pestana === 'datos' && <PanelDatos cliente={cliente} guardar={guardarCliente} eliminar={eliminarCliente} />}
        {pestana === 'servicios' && <PanelServicios cliente={cliente} servicios={servicios} guardar={guardarCliente} />}
        {pestana === 'pipeline' && <PanelPipeline cliente={cliente} fases={fases} setFases={setFases} guardar={guardarCliente} recargar={cargar} />}
        {pestana === 'entregables' && <PanelEntregables cliente={cliente} entregables={entregables} setEntregables={setEntregables} setCliente={setCliente} recargar={cargar} />}
        {pestana === 'pagos' && <PanelPagos cliente={cliente} pagos={pagos} setPagos={setPagos} />}
        {pestana === 'accesos' && <PanelAccesos cliente={cliente} accesos={accesos} setAccesos={setAccesos} />}
        {pestana === 'documentos' && <PanelDocumentos cliente={cliente} emisor={emisor} documentos={documentos} accesos={accesos} archivos={archivos} entregables={entregables} setDocumentos={setDocumentos} setArchivos={setArchivos} setAccesos={setAccesos} setCliente={setCliente} guardar={guardarCliente} />}
        {pestana === 'archivos' && <PanelArchivos cliente={cliente} archivos={archivos} setArchivos={setArchivos} />}
        {pestana === 'emails' && <PanelEmailsCliente cliente={cliente} />}
      </div>
    </div>
  );
}

// =============================================================
// PANEL: DATOS DEL CLIENTE - con modo Editar / Guardar / Cancelar
// =============================================================
function PanelDatos({ cliente, guardar, eliminar }) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [f, setF] = useState({ ...cliente });
  const [guardando, setGuardando] = useState(false);

  // Cuando cambia el cliente desde fuera (por ejemplo tras un guardado), refrescamos
  useEffect(() => {
    setF({ ...cliente });
    setModoEdicion(false);
  }, [cliente.id]);

  function up(k, v) {
    setF({ ...f, [k]: v });
  }

  function entrarEdicion() {
    setF({ ...cliente });
    setModoEdicion(true);
  }

  function cancelar() {
    if (JSON.stringify(f) !== JSON.stringify(cliente)) {
      if (!confirm('Tienes cambios sin guardar. Descartar?')) return;
    }
    setF({ ...cliente });
    setModoEdicion(false);
  }

  async function onGuardar() {
    setGuardando(true);
    try {
      // Solo enviamos los campos editables del panel datos. NO mandamos firma_cliente
      // ni fecha_firma para no arriesgarnos a borrarlas por accidente.
      const cambios = {
        id: f.id,
        estado: f.estado,
        tipo_persona: f.tipo_persona,
        nombre: f.nombre,
        nif: f.nif,
        contacto: f.contacto,
        direccion: f.direccion,
        cp: f.cp,
        ciudad: f.ciudad,
        provincia: f.provincia,
        pais: f.pais,
        email: f.email,
        telefono: f.telefono,
        estado_proyecto: f.estado_proyecto,
        fecha_inicio: f.fecha_inicio,
        fecha_fin_prevista: f.fecha_fin_prevista,
        fecha_fin_real: f.fecha_fin_real,
        notas: f.notas,
      };
      await guardar(cambios);
      setModoEdicion(false);
      alert('Cambios guardados');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  const ro = !modoEdicion; // ro = read-only

  return (
    <div>
      <div className="cabecera-panel">
        <h3 style={{ margin: 0 }}>Datos del cliente</h3>
        <div className="cabecera-acciones">
          {ro ? (
            <button onClick={entrarEdicion} className="btn-principal">Editar datos</button>
          ) : (
            <>
              <button onClick={cancelar} disabled={guardando}>Cancelar</button>
              <button onClick={onGuardar} disabled={guardando} className="btn-principal">
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </>
          )}
        </div>
      </div>

      {ro && (
        <div className="aviso-lectura">
          Estas viendo los datos en modo solo lectura. Pulsa "Editar datos" si necesitas cambiar algo.
        </div>
      )}

      <div className="grid2">
        <label>Nombre / Razon social
          <input value={f.nombre || ''} onChange={(e) => up('nombre', e.target.value)} disabled={ro} />
        </label>
        <label>Tipo
          <select value={f.tipo_persona || 'Fisica'} onChange={(e) => up('tipo_persona', e.target.value)} disabled={ro}>
            <option value="Fisica">Fisica</option>
            <option value="Juridica">Juridica</option>
          </select>
        </label>
        <label>NIF / CIF
          <input value={f.nif || ''} onChange={(e) => up('nif', e.target.value.toUpperCase())} disabled={ro} />
        </label>
        <label>Persona de contacto
          <input value={f.contacto || ''} onChange={(e) => up('contacto', e.target.value)} disabled={ro} />
        </label>
        <label>Email
          <input type="email" value={f.email || ''} onChange={(e) => up('email', e.target.value)} disabled={ro} />
        </label>
        <label>Telefono
          <input value={f.telefono || ''} onChange={(e) => up('telefono', e.target.value)} disabled={ro} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Direccion
          <input value={f.direccion || ''} onChange={(e) => up('direccion', e.target.value)} disabled={ro} />
        </label>
        <label>CP
          <input value={f.cp || ''} onChange={(e) => up('cp', e.target.value)} disabled={ro} />
        </label>
        <label>Ciudad
          <input value={f.ciudad || ''} onChange={(e) => up('ciudad', e.target.value)} disabled={ro} />
        </label>
        <label>Provincia
          <input value={f.provincia || ''} onChange={(e) => up('provincia', e.target.value)} disabled={ro} />
        </label>
        <label>Pais
          <input value={f.pais || ''} onChange={(e) => up('pais', e.target.value)} disabled={ro} />
        </label>
        <label>Estado del cliente
          <select value={f.estado || 'Pendiente firma'} onChange={(e) => up('estado', e.target.value)} disabled={ro}>
            <option>Pendiente firma</option>
            <option>Firmado</option>
            <option>Activo</option>
            <option>Pausado</option>
            <option>Finalizado</option>
            <option>Cancelado</option>
          </select>
        </label>
        <label>Estado del proyecto
          <select value={f.estado_proyecto || 'Sin iniciar'} onChange={(e) => up('estado_proyecto', e.target.value)} disabled={ro}>
            {ESTADOS_PROYECTO.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Fecha inicio prevista
          <input type="date" value={f.fecha_inicio || ''} onChange={(e) => up('fecha_inicio', e.target.value)} disabled={ro} />
        </label>
        <label>Fecha fin prevista
          <input type="date" value={f.fecha_fin_prevista || ''} onChange={(e) => up('fecha_fin_prevista', e.target.value)} disabled={ro} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Notas internas
          <textarea rows="3" value={f.notas || ''} onChange={(e) => up('notas', e.target.value)} disabled={ro} />
        </label>
      </div>

      {/* Zona de peligro: eliminar cliente, separada y con doble confirmacion */}
      {ro && (
        <div className="zona-peligro">
          <div>
            <strong>Eliminar cliente</strong>
            <p>Borra al cliente y todos sus datos: pagos, fases, accesos, documentos y archivos. Esta accion no se puede deshacer.</p>
          </div>
          <button onClick={eliminar} className="btn-peligro-grande">Eliminar cliente</button>
        </div>
      )}
    </div>
  );
}

// =============================================================
// PANEL: SERVICIOS - con modo Editar / Guardar / Cancelar
// =============================================================
function PanelServicios({ cliente, servicios, guardar }) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [lineas, setLineas] = useState(cliente.servicios_json || []);
  const [iva, setIva] = useState(cliente.iva || 21);
  const [formaPago, setFormaPago] = useState(cliente.forma_pago || '50% al inicio, 50% a la entrega');
  const [plazo, setPlazo] = useState(cliente.plazo || '');
  const [descripcion, setDescripcion] = useState(cliente.descripcion || '');
  const [generarContrato, setGenerarContrato] = useState(false);
  const [guardando, setGuardando] = useState(false);

  function resetear() {
    setLineas(cliente.servicios_json || []);
    setIva(cliente.iva || 21);
    setFormaPago(cliente.forma_pago || '50% al inicio, 50% a la entrega');
    setPlazo(cliente.plazo || '');
    setDescripcion(cliente.descripcion || '');
    setGenerarContrato(false);
  }

  useEffect(() => {
    resetear();
    setModoEdicion(false);
  }, [cliente.id]);

  const totales = useMemo(() => {
    let base = 0;
    lineas.forEach(s => { base += (parseFloat(s.cantidad) || 0) * (parseFloat(s.precio) || 0); });
    const ivaImp = base * (parseFloat(iva) || 0) / 100;
    return { base, iva: ivaImp, total: base + ivaImp };
  }, [lineas, iva]);

  function addLinea(serv) {
    setLineas([...lineas, { nombre: serv ? serv.nombre : '', cantidad: 1, precio: serv ? Number(serv.precio) : 0, categoria: serv ? serv.categoria : '' }]);
  }
  function delLinea(i) { setLineas(lineas.filter((_, j) => j !== i)); }
  function upLinea(i, k, v) {
    const nuevas = [...lineas]; nuevas[i] = { ...nuevas[i], [k]: v }; setLineas(nuevas);
  }

  function entrarEdicion() {
    resetear();
    setModoEdicion(true);
  }

  function cancelar() {
    if (confirm('Descartar cambios sin guardar?')) {
      resetear();
      setModoEdicion(false);
    }
  }

  async function onGuardar() {
    if (cliente.numero_contrato && !confirm('Este cliente ya tiene contrato generado. Si cambias servicios o precios, los pagos pendientes se recalcularan proporcionalmente. Continuar?')) return;
    setGuardando(true);
    try {
      await guardar({
        servicios_json: lineas,
        iva, forma_pago: formaPago, plazo, descripcion,
        generar_contrato: generarContrato && !cliente.numero_contrato,
      });
      setModoEdicion(false);
      alert('Servicios guardados' + (generarContrato && !cliente.numero_contrato ? '. Contrato y pagos generados.' : ''));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  const ro = !modoEdicion;

  return (
    <div>
      <div className="cabecera-panel">
        <h3 style={{ margin: 0 }}>Servicios contratados</h3>
        <div className="cabecera-acciones">
          {ro ? (
            <button onClick={entrarEdicion} className="btn-principal">Editar servicios</button>
          ) : (
            <>
              <button onClick={cancelar} disabled={guardando}>Cancelar</button>
              <button onClick={onGuardar} disabled={guardando} className="btn-principal">
                {guardando ? 'Guardando...' : 'Guardar servicios'}
              </button>
            </>
          )}
        </div>
      </div>

      {ro && (
        <div className="aviso-lectura">
          Estas viendo los servicios en modo solo lectura. Pulsa "Editar servicios" si necesitas cambiar algo.
        </div>
      )}

      {lineas.length === 0 && ro ? (
        <p style={{ color: '#666' }}>Este cliente todavia no tiene servicios contratados.</p>
      ) : (
        lineas.map((l, i) => (
          <div key={i} className="linea-servicio">
            <select
              value={l.nombre || ''}
              disabled={ro}
              onChange={(e) => {
                const sv = servicios.find(s => s.nombre === e.target.value);
                upLinea(i, 'nombre', e.target.value);
                if (sv) {
                  upLinea(i, 'precio', Number(sv.precio));
                  upLinea(i, 'categoria', sv.categoria);
                }
              }}
            >
              <option value="">-- Selecciona servicio --</option>
              {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre} ({fmtEuros(s.precio)})</option>)}
            </select>
            <input type="number" min="1" value={l.cantidad || 1} onChange={(e) => upLinea(i, 'cantidad', e.target.value)} placeholder="Cant" disabled={ro} />
            <input type="number" step="0.01" value={l.precio || 0} onChange={(e) => upLinea(i, 'precio', e.target.value)} placeholder="Precio" disabled={ro} />
            <span>{fmtEuros((parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0))}</span>
            {!ro && <button onClick={() => delLinea(i)}>Quitar</button>}
          </div>
        ))
      )}

      {!ro && <button onClick={() => addLinea(null)}>+ Anadir linea</button>}

      <div className="grid2" style={{ marginTop: 20 }}>
        <label>IVA (%)
          <input type="number" value={iva} onChange={(e) => setIva(e.target.value)} disabled={ro} />
        </label>
        <label>Forma de pago
          <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} disabled={ro}>
            <option>50% al inicio, 50% a la entrega</option>
            <option>30% al inicio, 70% a la entrega</option>
            <option>100% al inicio</option>
            <option>100% a la entrega</option>
            <option>Cuota mensual recurrente</option>
          </select>
        </label>
        <label>Plazo de entrega
          <input value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Ej: 30 dias naturales" disabled={ro} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Descripcion del proyecto
          <textarea rows="3" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={ro} />
        </label>
      </div>

      <div className="resumen-totales">
        <p>Base imponible: <strong>{fmtEuros(totales.base)}</strong></p>
        <p>IVA ({iva}%): <strong>{fmtEuros(totales.iva)}</strong></p>
        <p className="total-final">TOTAL: {fmtEuros(totales.total)}</p>
      </div>

      {!ro && !cliente.numero_contrato && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={generarContrato} onChange={(e) => setGenerarContrato(e.target.checked)} />
          Al guardar, generar numero de contrato y crear los pagos automaticamente
        </label>
      )}
    </div>
  );
}

// =============================================================
// PANEL: PIPELINE - Fases reales del proyecto
// =============================================================
function PanelPipeline({ cliente, fases, setFases, guardar, recargar }) {
  const [editando, setEditando] = useState(null);

  async function aplicarPlantilla(sustituir) {
    const msg = sustituir
      ? 'Esto borrara las fases actuales y creara las plantilla. Continuar?'
      : 'Esto anadira las fases de plantilla a las que ya tienes. Continuar?';
    if (!confirm(msg)) return;
    try {
      await api.aplicarPlantilla(cliente.id, sustituir);
      await recargar();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function cambiarEstado(fase, nuevoEstado) {
    try {
      const actualizada = await api.faseUpdate({ ...fase, estado: nuevoEstado });
      setFases(fases.map(f => f.id === fase.id ? actualizada : f));
      // Recargar cliente para ver el nuevo porcentaje
      const c = await api.clienteGet(cliente.id);
      // Hack: forzar reload del cliente padre
      window.dispatchEvent(new Event('storage'));
      Object.assign(cliente, c);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function eliminar(fase) {
    if (!confirm('Eliminar la fase "' + fase.nombre + '"?')) return;
    try {
      await api.faseDelete(fase.id);
      setFases(fases.filter(f => f.id !== fase.id));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function guardarFase(datos) {
    try {
      let saved;
      if (datos.id) {
        saved = await api.faseUpdate(datos);
        setFases(fases.map(f => f.id === datos.id ? saved : f));
      } else {
        saved = await api.faseCreate({ ...datos, cliente_id: cliente.id, orden: fases.length + 1 });
        setFases([...fases, saved]);
      }
      setEditando(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const totalPesos = fases.reduce((s, f) => s + Number(f.peso), 0);
  const completadasPeso = fases.filter(f => f.estado === 'Completada').reduce((s, f) => s + Number(f.peso), 0);

  return (
    <div>
      <h3>Pipeline del proyecto</h3>

      {fases.length === 0 ? (
        <div className="estado-vacio">
          <p>Este proyecto todavia no tiene fases. Puedes generarlas automaticamente desde una plantilla segun los servicios contratados.</p>
          <button onClick={() => aplicarPlantilla(false)}>Generar pipeline desde plantilla</button>
          <button onClick={() => setEditando({ nombre: '', peso: 10, estado: 'Pendiente' })}>O anadir fase manual</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => setEditando({ nombre: '', peso: 10, estado: 'Pendiente' })}>+ Anadir fase</button>
            <button onClick={() => aplicarPlantilla(false)}>Anadir fases de plantilla</button>
            <button onClick={() => aplicarPlantilla(true)} style={{ background: '#ef4444' }}>Sustituir por plantilla</button>
          </div>

          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            {fases.length} fases, suma de pesos: {totalPesos}, completadas: {completadasPeso}/{totalPesos}
          </div>

          <div className="lista-fases">
            {fases.sort((a, b) => a.orden - b.orden).map(f => (
              <FaseFila
                key={f.id}
                fase={f}
                onCambiarEstado={cambiarEstado}
                onEditar={() => setEditando(f)}
                onEliminar={() => eliminar(f)}
              />
            ))}
          </div>
        </>
      )}

      {editando && (
        <ModalFase
          inicial={editando}
          onGuardar={guardarFase}
          onCancelar={() => setEditando(null)}
        />
      )}

      <div style={{ marginTop: 30, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Notas del proyecto</h4>
        <textarea
          rows="4"
          style={{ width: '100%' }}
          defaultValue={cliente.notas_proyecto || ''}
          onBlur={(e) => guardar({ notas_proyecto: e.target.value })}
          placeholder="Notas internas del seguimiento del proyecto..."
        />
      </div>
    </div>
  );
}

function FaseFila({ fase, onCambiarEstado, onEditar, onEliminar }) {
  const colores = {
    'Pendiente': '#9ca3af',
    'En curso': '#3b82f6',
    'Bloqueada': '#ef4444',
    'Completada': '#10b981',
  };
  return (
    <div className={`fase-fila estado-${fase.estado.toLowerCase().replace(' ', '-')}`}>
      <div className="fase-orden">{fase.orden}</div>
      <div className="fase-info">
        <div className="fase-nombre">{fase.nombre}</div>
        <div className="fase-meta">
          Peso: {fase.peso}%
          {fase.fecha_real_inicio && ` | Iniciada ${new Date(fase.fecha_real_inicio).toLocaleDateString('es-ES')}`}
          {fase.fecha_real_fin && ` | Completada ${new Date(fase.fecha_real_fin).toLocaleDateString('es-ES')}`}
        </div>
        {fase.notas && <div className="fase-notas">{fase.notas}</div>}
      </div>
      <div className="fase-estado-actual" style={{ background: colores[fase.estado] }}>{fase.estado}</div>
      <select value={fase.estado} onChange={(e) => onCambiarEstado(fase, e.target.value)}>
        <option>Pendiente</option>
        <option>En curso</option>
        <option>Bloqueada</option>
        <option>Completada</option>
      </select>
      <button onClick={onEditar}>Editar</button>
      <button onClick={onEliminar} className="btn-peligro">X</button>
    </div>
  );
}

function ModalFase({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({ ...inicial });
  function up(k, v) { setF({ ...f, [k]: v }); }
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? 'Editar fase' : 'Nueva fase'}</h3>
        <label>Nombre
          <input value={f.nombre || ''} onChange={(e) => up('nombre', e.target.value)} autoFocus />
        </label>
        <div className="grid2">
          <label>Peso (%)
            <input type="number" min="1" max="100" value={f.peso || 10} onChange={(e) => up('peso', parseInt(e.target.value, 10) || 10)} />
          </label>
          <label>Estado
            <select value={f.estado || 'Pendiente'} onChange={(e) => up('estado', e.target.value)}>
              <option>Pendiente</option>
              <option>En curso</option>
              <option>Bloqueada</option>
              <option>Completada</option>
            </select>
          </label>
          <label>Fecha prevista inicio
            <input type="date" value={f.fecha_prevista_inicio || ''} onChange={(e) => up('fecha_prevista_inicio', e.target.value)} />
          </label>
          <label>Fecha prevista fin
            <input type="date" value={f.fecha_prevista_fin || ''} onChange={(e) => up('fecha_prevista_fin', e.target.value)} />
          </label>
        </div>
        <label>Notas
          <textarea rows="3" value={f.notas || ''} onChange={(e) => up('notas', e.target.value)} />
        </label>
        <div className="modal-acciones">
          <button onClick={onCancelar}>Cancelar</button>
          <button onClick={() => onGuardar(f)} disabled={!f.nombre}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PANEL: PAGOS
// =============================================================
function PanelPagos({ cliente, pagos, setPagos }) {
  const [editando, setEditando] = useState(null);
  const [simulacion, setSimulacion] = useState(null);
  const [regenerando, setRegenerando] = useState(false);

  async function eliminar(p) {
    if (!confirm('Eliminar este pago?')) return;
    try {
      await api.pagoDelete(p.id);
      setPagos(pagos.filter(x => x.id !== p.id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function simularRegeneracion() {
    setRegenerando(true);
    try {
      const r = await api.regenerarPagos(cliente.id, 'simular');
      setSimulacion(r);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setRegenerando(false);
    }
  }

  async function aplicarRegeneracion() {
    if (!confirm('Vas a CREAR ' + simulacion.pagos_a_crear + ' pagos nuevos en este cliente. No se borra nada existente. Continuar?')) return;
    setRegenerando(true);
    try {
      const r = await api.regenerarPagos(cliente.id, 'aplicar');
      alert('Listo. Se crearon ' + r.creados + ' pagos.');
      // Recargar lista de pagos
      const lista = await api.pagosList(cliente.id);
      setPagos(lista);
      setSimulacion(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setRegenerando(false);
    }
  }

  async function guardar(datos) {
    try {
      let saved;
      if (datos.id) {
        saved = await api.pagoUpdate(datos);
        setPagos(pagos.map(p => p.id === datos.id ? saved : p));
      } else {
        saved = await api.pagoCreate({ ...datos, cliente_id: cliente.id });
        setPagos([...pagos, saved]);
      }
      setEditando(null);
    } catch (err) { alert('Error: ' + err.message); }
  }

  const totales = pagos.reduce((acc, p) => {
    if (p.estado === 'Cobrado') acc.cobrado += Number(p.importe);
    else if (p.estado === 'Pendiente') acc.pendiente += Number(p.importe);
    else if (p.estado === 'Cancelado') acc.cancelado += Number(p.importe);
    return acc;
  }, { cobrado: 0, pendiente: 0, cancelado: 0 });

  return (
    <div>
      <h3>Pagos del cliente</h3>
      <div className="resumen-pagos">
        <div className="card-pago"><span>Cobrado</span><strong>{fmtEuros(totales.cobrado)}</strong></div>
        <div className="card-pago"><span>Pendiente</span><strong style={{ color: '#f59e0b' }}>{fmtEuros(totales.pendiente)}</strong></div>
        <div className="card-pago"><span>Cancelado</span><strong style={{ color: '#9ca3af' }}>{fmtEuros(totales.cancelado)}</strong></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setEditando({ concepto: '', importe: 0, estado: 'Pendiente' })}>+ Nuevo pago</button>
        <button
          onClick={simularRegeneracion}
          disabled={regenerando}
          title="Regenera los pagos segun los servicios y forma de pago del cliente. Util tras incidente o cambio de servicios. NO borra los pagos existentes, solo anade los que faltan."
        >
          {regenerando ? 'Calculando...' : 'Regenerar pagos del contrato'}
        </button>
      </div>

      {simulacion && (
        <div className="modal-overlay" onClick={() => !regenerando && setSimulacion(null)}>
          <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Regenerar pagos - Vista previa</h3>
              <button onClick={() => !regenerando && setSimulacion(null)}>X</button>
            </div>
            <p style={{ color: '#666' }}>
              Cliente: <strong>{simulacion.cliente.nombre}</strong> · Total: <strong>{fmtEuros(simulacion.cliente.total)}</strong> · Forma de pago: <strong>{simulacion.cliente.forma_pago}</strong>
            </p>
            <div className="resumen-pagos">
              <div className="card-pago"><span>Pagos existentes</span><strong>{simulacion.pagos_existentes}</strong></div>
              <div className="card-pago"><span>A crear</span><strong style={{ color: '#10b981' }}>{simulacion.pagos_a_crear}</strong></div>
              <div className="card-pago"><span>Ya existen (se omiten)</span><strong style={{ color: '#9ca3af' }}>{simulacion.pagos_ya_existentes}</strong></div>
            </div>
            {simulacion.pagos_a_crear === 0 ? (
              <div style={{ padding: 16, background: '#f0fdf4', borderLeft: '3px solid #10b981', borderRadius: 4, margin: '16px 0' }}>
                Todos los pagos del contrato ya existen. No hay nada que regenerar.
              </div>
            ) : (
              <>
                <h4 style={{ marginTop: 16 }}>Pagos que se crearian:</h4>
                <table className="tabla-pagos">
                  <thead><tr><th>Concepto</th><th>Importe</th><th>Esperada</th><th>Recurrente</th></tr></thead>
                  <tbody>
                    {simulacion.vista_previa.map((p, i) => (
                      <tr key={i}>
                        <td>{p.concepto}</td>
                        <td>{fmtEuros(p.importe)}</td>
                        <td>{p.fecha_esperada}</td>
                        <td>{p.es_recurrente ? p.mes_recurrencia : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {simulacion.pagos_a_crear > simulacion.vista_previa.length && (
                  <p style={{ color: '#666', fontSize: 13 }}>... y {simulacion.pagos_a_crear - simulacion.vista_previa.length} mas.</p>
                )}
              </>
            )}
            <div className="modal-acciones">
              <button onClick={() => setSimulacion(null)} disabled={regenerando}>Cancelar</button>
              {simulacion.pagos_a_crear > 0 && (
                <button onClick={aplicarRegeneracion} disabled={regenerando} className="btn-principal">
                  {regenerando ? 'Creando...' : `Crear los ${simulacion.pagos_a_crear} pagos`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <table className="tabla-pagos">
        <thead><tr><th>Concepto</th><th>Importe</th><th>Esperada</th><th>Pago</th><th>Estado</th><th>Metodo</th><th></th></tr></thead>
        <tbody>
          {pagos.map(p => (
            <tr key={p.id}>
              <td>{p.concepto}{p.es_recurrente && <span className="pill mensual">{p.mes_recurrencia}</span>}</td>
              <td>{fmtEuros(p.importe)}</td>
              <td>{p.fecha_esperada ? new Date(p.fecha_esperada).toLocaleDateString('es-ES') : '-'}</td>
              <td>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-ES') : '-'}</td>
              <td><span className={`pill estado-pago-${(p.estado || '').toLowerCase()}`}>{p.estado}</span></td>
              <td>{p.metodo}</td>
              <td>
                <button onClick={() => setEditando(p)}>Editar</button>
                <button onClick={() => eliminar(p)} className="btn-peligro">X</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editando && <ModalPago inicial={editando} onGuardar={guardar} onCancelar={() => setEditando(null)} />}
    </div>
  );
}

function ModalPago({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({ ...inicial });
  function up(k, v) { setF({ ...f, [k]: v }); }
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? 'Editar pago' : 'Nuevo pago'}</h3>
        <label>Concepto<input value={f.concepto || ''} onChange={(e) => up('concepto', e.target.value)} /></label>
        <div className="grid2">
          <label>Importe<input type="number" step="0.01" value={f.importe || 0} onChange={(e) => up('importe', e.target.value)} /></label>
          <label>Estado
            <select value={f.estado || 'Pendiente'} onChange={(e) => up('estado', e.target.value)}>
              <option>Pendiente</option><option>Cobrado</option><option>Cancelado</option>
            </select>
          </label>
          <label>Fecha esperada<input type="date" value={f.fecha_esperada || ''} onChange={(e) => up('fecha_esperada', e.target.value)} /></label>
          <label>Fecha de pago<input type="date" value={f.fecha_pago || ''} onChange={(e) => up('fecha_pago', e.target.value)} /></label>
          <label>Metodo
            <select value={f.metodo || 'Transferencia'} onChange={(e) => up('metodo', e.target.value)}>
              <option>Transferencia</option><option>Bizum</option><option>Stripe</option><option>Efectivo</option><option>Otros</option>
            </select>
          </label>
        </div>
        <label>Notas<textarea rows="2" value={f.notas || ''} onChange={(e) => up('notas', e.target.value)} /></label>
        <div className="modal-acciones">
          <button onClick={onCancelar}>Cancelar</button>
          <button onClick={() => onGuardar(f)} disabled={!f.concepto}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PANEL: ACCESOS - Credenciales del cliente cifradas
// =============================================================
function PanelAccesos({ cliente, accesos, setAccesos }) {
  const [editando, setEditando] = useState(null);
  const [verPasswords, setVerPasswords] = useState(false);
  const [accesosConPwd, setAccesosConPwd] = useState({});

  async function recargarConPasswords() {
    if (!confirm('Vas a mostrar todas las contrasenas guardadas en pantalla. Asegurate de que nadie mas ve la pantalla. Continuar?')) return;
    try {
      const lista = await api.accesosList(cliente.id, true);
      const mapa = {};
      lista.forEach(a => { mapa[a.id] = a.password || ''; });
      setAccesosConPwd(mapa);
      setVerPasswords(true);
    } catch (err) { alert('Error: ' + err.message); }
  }

  function ocultarPasswords() {
    setAccesosConPwd({});
    setVerPasswords(false);
  }

  async function copiarPassword(accesoId) {
    try {
      // Si ya las tenemos cargadas, copiar de memoria
      let pwd = accesosConPwd[accesoId];
      if (pwd === undefined) {
        const lista = await api.accesosList(cliente.id, true);
        const a = lista.find(x => x.id === accesoId);
        pwd = a ? a.password : '';
      }
      if (!pwd) { alert('Sin contrasena guardada'); return; }
      await navigator.clipboard.writeText(pwd);
      alert('Contrasena copiada al portapapeles');
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function eliminar(a) {
    if (!confirm('Eliminar el acceso "' + a.etiqueta + '"?')) return;
    try {
      await api.accesoDelete(a.id);
      setAccesos(accesos.filter(x => x.id !== a.id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function guardar(datos) {
    try {
      let saved;
      if (datos.id) {
        saved = await api.accesoUpdate(datos);
        setAccesos(accesos.map(x => x.id === datos.id ? saved : x));
      } else {
        saved = await api.accesoCreate({ ...datos, cliente_id: cliente.id });
        setAccesos([...accesos, saved]);
      }
      setEditando(null);
    } catch (err) { alert('Error: ' + err.message); }
  }

  const grupos = useMemo(() => {
    const g = {};
    accesos.forEach(a => {
      const k = a.categoria || 'Otros';
      if (!g[k]) g[k] = [];
      g[k].push(a);
    });
    return g;
  }, [accesos]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Accesos y credenciales</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {verPasswords ? (
            <button onClick={ocultarPasswords}>Ocultar contrasenas</button>
          ) : (
            <button onClick={recargarConPasswords} disabled={accesos.length === 0}>Ver todas las contrasenas</button>
          )}
          <button onClick={() => setEditando({ categoria: 'Email', etiqueta: '', importante: false })}>+ Nuevo acceso</button>
        </div>
      </div>

      <div className="aviso-cifrado">
        Las contrasenas se guardan cifradas con AES-256. Solo se descifran cuando tu las pides explicitamente.
      </div>

      {accesos.length === 0 ? (
        <div className="estado-vacio">
          <p>Aun no hay accesos guardados para este cliente.</p>
        </div>
      ) : (
        Object.keys(grupos).sort().map(cat => (
          <div key={cat} className="grupo-accesos">
            <h4>{cat}</h4>
            <div className="lista-accesos">
              {grupos[cat].map(a => (
                <AccesoCard
                  key={a.id}
                  acceso={a}
                  passwordVisible={verPasswords ? accesosConPwd[a.id] : null}
                  onCopiar={() => copiarPassword(a.id)}
                  onEditar={() => setEditando(a)}
                  onEliminar={() => eliminar(a)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {editando && <ModalAcceso inicial={editando} onGuardar={guardar} onCancelar={() => setEditando(null)} />}
    </div>
  );
}

function AccesoCard({ acceso, passwordVisible, onCopiar, onEditar, onEliminar }) {
  const [pwdAbierta, setPwdAbierta] = useState(false);
  return (
    <div className={`card-acceso ${acceso.importante ? 'importante' : ''}`}>
      <div className="card-acceso-cabecera">
        <strong>{acceso.etiqueta}</strong>
        {acceso.importante && <span className="pill importante">Importante</span>}
      </div>
      {acceso.url && (
        <div className="card-acceso-fila">
          <span className="ca-label">URL</span>
          <a href={acceso.url} target="_blank" rel="noopener noreferrer">{acceso.url}</a>
        </div>
      )}
      {acceso.usuario && (
        <div className="card-acceso-fila">
          <span className="ca-label">Usuario</span>
          <span className="ca-valor">{acceso.usuario}</span>
          <button className="ca-btn-mini" onClick={() => navigator.clipboard.writeText(acceso.usuario)}>Copiar</button>
        </div>
      )}
      {acceso.tiene_password && (
        <div className="card-acceso-fila">
          <span className="ca-label">Contrasena</span>
          {pwdAbierta && passwordVisible ? (
            <span className="ca-valor mono">{passwordVisible}</span>
          ) : (
            <span className="ca-valor">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
          )}
          {passwordVisible && (
            <button className="ca-btn-mini" onClick={() => setPwdAbierta(!pwdAbierta)}>{pwdAbierta ? 'Ocultar' : 'Mostrar'}</button>
          )}
          <button className="ca-btn-mini" onClick={onCopiar}>Copiar</button>
        </div>
      )}
      {acceso.notas && <div className="card-acceso-notas">{acceso.notas}</div>}
      <div className="card-acceso-acciones">
        <button onClick={onEditar}>Editar</button>
        <button onClick={onEliminar} className="btn-peligro">Eliminar</button>
      </div>
    </div>
  );
}

function ModalAcceso({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({ ...inicial, password: inicial.password || '' });
  const [verPwd, setVerPwd] = useState(false);
  function up(k, v) { setF({ ...f, [k]: v }); }
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? 'Editar acceso' : 'Nuevo acceso'}</h3>
        <div className="grid2">
          <label>Categoria
            <select value={f.categoria || 'Otros'} onChange={(e) => up('categoria', e.target.value)}>
              {CATEGORIAS_ACCESO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <input type="checkbox" checked={!!f.importante} onChange={(e) => up('importante', e.target.checked)} />
            Marcar como importante
          </label>
        </div>
        <label>Etiqueta
          <input value={f.etiqueta || ''} onChange={(e) => up('etiqueta', e.target.value)} placeholder="Ej: Email principal del cliente" autoFocus />
        </label>
        <label>URL
          <input value={f.url || ''} onChange={(e) => up('url', e.target.value)} placeholder="https://..." />
        </label>
        <div className="grid2">
          <label>Usuario / Email
            <input value={f.usuario || ''} onChange={(e) => up('usuario', e.target.value)} />
          </label>
          <label>Contrasena
            <div style={{ display: 'flex', gap: 4 }}>
              <input type={verPwd ? 'text' : 'password'} style={{ flex: 1 }} value={f.password || ''} onChange={(e) => up('password', e.target.value)} placeholder={f.id && !f.password ? '(sin cambios)' : ''} />
              <button type="button" onClick={() => setVerPwd(!verPwd)}>{verPwd ? 'Ocultar' : 'Ver'}</button>
            </div>
          </label>
        </div>
        <label>Notas
          <textarea rows="2" value={f.notas || ''} onChange={(e) => up('notas', e.target.value)} placeholder="Renovacion anual, observaciones, etc." />
        </label>
        <div className="modal-acciones">
          <button onClick={onCancelar}>Cancelar</button>
          <button onClick={() => onGuardar(f)} disabled={!f.etiqueta}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PANEL: DOCUMENTOS - Hoja, Cesion, Contrato y Acta
// =============================================================
function PanelDocumentos({ cliente, emisor, documentos, accesos, archivos, entregables, setDocumentos, setArchivos, setAccesos, setCliente, guardar }) {
  const [previsualizando, setPrevisualizando] = useState(null);
  const [tipoNuevo, setTipoNuevo] = useState(null);
  const [emailHab, setEmailHab] = useState(false);

  useEffect(() => {
    api.emailEstado().then(r => setEmailHab(r.habilitado)).catch(() => setEmailHab(false));
  }, []);

  async function abrirNuevo(tipo) {
    if (tipo === 'acta') {
      // Para el acta siempre cargamos accesos descifrados (para uso interno)
      try {
        const accDescifrados = await api.accesosList(cliente.id, true);
        setTipoNuevo({ tipo, accesosDescifrados: accDescifrados });
      } catch (err) {
        alert('Error: ' + err.message);
      }
    } else {
      setTipoNuevo({ tipo });
    }
  }

  async function abrirGuardado(doc) {
    try {
      const completo = await api.documentoGet(doc.id);
      setPrevisualizando(completo);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function eliminar(doc) {
    if (!confirm('Eliminar el documento "' + doc.nombre + '"?')) return;
    try {
      await api.documentoDelete(doc.id);
      setDocumentos(documentos.filter(d => d.id !== doc.id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  return (
    <div>
      <h3>Documentos</h3>
      <div className="botones-doc">
        {TIPOS_DOC.map(t => (
          <button key={t.id} onClick={() => abrirNuevo(t.id)}>
            + {t.nombre}
          </button>
        ))}
      </div>

      {documentos.length === 0 ? (
        <p style={{ color: '#666', marginTop: 16 }}>No hay documentos generados todavia.</p>
      ) : (
        <table className="tabla-docs">
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Firmado</th><th>Generado</th><th></th></tr></thead>
          <tbody>
            {documentos.map(d => (
              <tr key={d.id}>
                <td>{TIPOS_DOC.find(t => t.id === d.tipo)?.nombre || d.tipo}</td>
                <td>{d.nombre}</td>
                <td>{d.firmado ? `Si - ${new Date(d.fecha_firma).toLocaleDateString('es-ES')}` : 'No'}</td>
                <td>{new Date(d.creado_en).toLocaleDateString('es-ES')}</td>
                <td>
                  <button onClick={() => abrirGuardado(d)}>Ver</button>
                  <button onClick={() => eliminar(d)} className="btn-peligro">X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tipoNuevo && (
        <ModalGenerarDoc
          tipo={tipoNuevo.tipo}
          cliente={cliente}
          emisor={emisor}
          accesos={tipoNuevo.accesosDescifrados || accesos}
          archivos={archivos}
          entregables={entregables}
          emailHab={emailHab}
          onAccesosCambian={async () => {
            // Recargar lista de accesos del cliente y notificar al padre
            try {
              const lista = await api.accesosList(cliente.id, false);
              if (typeof setAccesos === 'function') setAccesos(lista);
            } catch {}
          }}
          onGuardado={async (doc) => {
            setDocumentos([doc, ...documentos]);
            setTipoNuevo(null);
            if (doc.firmado) {
              const [c, ar] = await Promise.all([
                api.clienteGet(cliente.id),
                api.archivosList(cliente.id),
              ]);
              setCliente(c);
              if (typeof setArchivos === 'function') setArchivos(ar);
            }
          }}
          onActualizarCliente={(data) => guardar(data)}
          onCerrar={() => setTipoNuevo(null)}
        />
      )}

      {previsualizando && (
        <ModalVerDoc
          documento={previsualizando}
          cliente={cliente}
          emailHab={emailHab}
          onCerrar={() => setPrevisualizando(null)}
        />
      )}
    </div>
  );
}

function ModalGenerarDoc({ tipo, cliente, emisor, accesos, archivos, entregables, emailHab, onGuardado, onActualizarCliente, onAccesosCambian, onCerrar }) {
  const [paso, setPaso] = useState('preview'); // preview | firma
  const [firmaURL, setFirmaURL] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [logoDataURL, setLogoDataURL] = useState('');

  // Acta tiene dos modos: borrador (uso interno) y definitiva (para cliente)
  // Por defecto borrador. Solo se permite definitiva si estado_proyecto = "Entregado y aceptado"
  const [modoActa, setModoActa] = useState('borrador');
  const [qrDataURL, setQrDataURL] = useState(null);
  const [datosAcceso, setDatosAcceso] = useState(null); // {token, pin, codigo_aceptacion, url_acceso}
  const [generandoAcceso, setGenerandoAcceso] = useState(false);
  const [enviarEmailPin, setEnviarEmailPin] = useState(true);

  // Accesos en estado local: arranca con la prop pero se actualiza al
  // anadir credenciales desde el asistente del Acta. Asi el preview del
  // documento se regenera con los nuevos accesos sin cerrar el modal.
  const [accesosLocal, setAccesosLocal] = useState(accesos || []);
  useEffect(() => { setAccesosLocal(accesos || []); }, [accesos]);

  async function recargarAccesosLocal() {
    try {
      // Cargar con password descifrada para que aparezcan en el Acta
      const lista = await api.accesosList(cliente.id, true);
      setAccesosLocal(lista);
      if (typeof onAccesosCambian === 'function') onAccesosCambian();
    } catch (err) {
      console.error('Error recargando accesos:', err.message);
    }
  }

  // Archivos en estado local. Cuando marcamos "incluir_en_acta" en alguno,
  // recargamos para reflejar el cambio.
  const [archivosLocal, setArchivosLocal] = useState(archivos || []);
  useEffect(() => { setArchivosLocal(archivos || []); }, [archivos]);

  async function recargarArchivosLocal() {
    try {
      const lista = await api.archivosList(cliente.id);
      setArchivosLocal(lista);
    } catch (err) {
      console.error('Error recargando archivos:', err.message);
    }
  }

  // Lista de archivos seleccionados para incluir en la lista del Acta.
  // No se descargan ni se embeben en el PDF, solo aparecen como lista
  // textual con nombre y tamano. Asi el PDF no se hace gigante.
  const imagenesDataURL = useMemo(() => {
    return (archivosLocal || [])
      .filter(a => a.incluir_en_acta)
      .map(a => ({ id: a.id, nombre: a.nombre, tamano: a.tamano, tipo: a.tipo }));
  }, [archivosLocal]);

  const ref = useRef(null);
  const tipoInfo = TIPOS_DOC.find(t => t.id === tipo);
  const esActaDefinitiva = tipo === 'acta' && modoActa === 'definitiva';
  // Comparacion robusta: normaliza tildes, mayusculas y espacios para evitar
  // que un valor con tilde diferente bloquee el radio "Definitiva".
  const _norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const puedeDefinitiva = _norm(cliente.estado_proyecto) === _norm('Entregado y aceptado');

  async function ponerEnEntregado() {
    if (!confirm('Voy a cambiar el estado del proyecto del cliente a "Entregado y aceptado". ¿Seguro?')) return;
    try {
      const actualizado = await api.clienteUpdate({ id: cliente.id, estado_proyecto: 'Entregado y aceptado' });
      if (typeof onActualizarCliente === 'function') onActualizarCliente(actualizado);
      alert('Estado actualizado. Ya puedes marcar el modo Definitiva.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // Precargar el logo como dataURL base64. Esto evita problemas de CORS
  // al generar el PDF con html2pdf (html2canvas no carga imagenes externas
  // si tienen CORS y en Vercel el favicon no envia los headers correctos).
  useEffect(() => {
    let cancelado = false;
    async function cargarLogo() {
      try {
        const res = await fetch('/logo-conecta-nex.png', { cache: 'force-cache' });
        if (!res.ok) {
          console.error('[Logo] No se pudo descargar logo-conecta-nex.png. Status:', res.status);
          // Fallback: usar un dataURL minimo (1x1 transparente) para no bloquear el flujo
          if (!cancelado) setLogoDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
          return;
        }
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelado) {
            setLogoDataURL(reader.result || '');
            console.log('[Logo] Cargado correctamente, tamano:', blob.size, 'bytes');
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('[Logo] Fallo al cargar:', err.message);
        // Fallback para no bloquear
        if (!cancelado) setLogoDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
      }
    }
    cargarLogo();
    return () => { cancelado = true; };
  }, []);

  // Emisor con logo embebido para los documentos
  const emisorConLogo = useMemo(() => ({ ...emisor, logo_data_url: logoDataURL }), [emisor, logoDataURL]);

  const html = useMemo(
    () => generarPorTipo(tipo, { ...cliente, fecha_firma: firmaURL ? new Date().toISOString() : cliente.fecha_firma }, emisorConLogo, firmaURL, {
      accesos: accesosLocal,
      archivos: archivosLocal,
      entregables,
      modo: modoActa,
      qr_dataurl: qrDataURL,
      url_acceso: datosAcceso?.url_acceso,
      codigo_aceptacion: datosAcceso?.codigo_aceptacion,
      branding: cliente.branding_json || {},
      imagenes_dataurl: imagenesDataURL,
    }),
    [tipo, cliente, emisorConLogo, firmaURL, accesosLocal, archivosLocal, entregables, modoActa, qrDataURL, datosAcceso, imagenesDataURL]
  );

  async function descargarPDF() {
    if (!ref.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    const sufijo = tipo === 'acta' ? `-${modoActa}` : '';
    const opt = {
      margin: 0,
      filename: `${tipoInfo.nombre.toLowerCase().replace(/ /g, '-')}${sufijo}-${cliente.numero_contrato || cliente.numero_cliente}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(ref.current).save();
  }

  // Genera el QR + PIN + codigo y devuelve TODO (acceso + dataURL del QR).
  // Solo se llama si tipo === 'acta' y modoActa === 'definitiva'.
  async function generarPiezasSeguridad() {
    setGenerandoAcceso(true);
    try {
      // 1. Crear el acceso en la BD (genera token, PIN, codigo)
      const r = await api.generarAccesoActa(cliente.id, null, enviarEmailPin && !!cliente.email);

      // 2. Generar el QR como dataURL con la libreria qrcode
      const QRCode = (await import('qrcode')).default;
      const dataURL = await QRCode.toDataURL(r.url_acceso, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 280,
        color: { dark: '#047857', light: '#ffffff' },
      });

      setQrDataURL(dataURL);
      setDatosAcceso(r);
      // Devolvemos ambos para evitar el problema de closure de React
      return { acceso: r, qrDataUrlLocal: dataURL };
    } catch (err) {
      alert('Error generando acceso seguro: ' + err.message);
      throw err;
    } finally {
      setGenerandoAcceso(false);
    }
  }

  async function guardarDocumento(firmado) {
    setGuardando(true);
    try {
      // Si es acta definitiva y aun no hay datos de acceso, generamos QR + PIN antes de guardar
      let accesoFinal = datosAcceso;
      let qrDataURLLocal = qrDataURL;
      if (esActaDefinitiva && !accesoFinal && firmado) {
        const piezas = await generarPiezasSeguridad();
        accesoFinal = piezas.acceso;
        qrDataURLLocal = piezas.qrDataUrlLocal;
      }

      // Re-renderizar el HTML con el QR ya incrustado y los accesos LOCALES
      // (que incluyen las credenciales que se acaban de anadir desde el asistente).
      const htmlFinal = generarPorTipo(tipo, { ...cliente, fecha_firma: firmado ? new Date().toISOString() : cliente.fecha_firma }, emisorConLogo, firmaURL, {
        accesos: accesosLocal,
        archivos: archivosLocal,
        entregables,
        modo: modoActa,
        qr_dataurl: qrDataURLLocal,
        url_acceso: accesoFinal?.url_acceso,
        codigo_aceptacion: accesoFinal?.codigo_aceptacion,
        branding: cliente.branding_json || {},
        imagenes_dataurl: imagenesDataURL,
      });

      const nombreDoc = tipo === 'acta'
        ? `${tipoInfo.nombre} (${modoActa === 'definitiva' ? 'definitiva' : 'borrador'}) - ${cliente.nombre}`
        : `${tipoInfo.nombre} - ${cliente.nombre}`;

      const doc = await api.documentoCreate({
        cliente_id: cliente.id,
        tipo,
        nombre: nombreDoc,
        contenido_html: htmlFinal,
        firmado,
      });

      if (firmado && firmaURL) {
        // Guardar firma como archivo PNG (siempre)
        try {
          const base64 = firmaURL.split(',')[1] || firmaURL;
          const fechaHoy = new Date().toISOString().slice(0, 10);
          await api.archivoUpload({
            cliente_id: cliente.id,
            nombre: `Firma cliente - ${tipoInfo.nombre} - ${fechaHoy}.png`,
            tipo: 'image/png',
            contenido_base64: base64,
          });
        } catch (errArch) {
          console.error('No se pudo guardar la firma como archivo:', errArch.message);
        }

        // Si es Hoja o Contrato, marcar cliente como firmado
        if (tipo === 'contrato' || tipo === 'hoja') {
          await onActualizarCliente({
            firma_cliente: firmaURL,
            fecha_firma: new Date().toISOString(),
            estado: 'Firmado',
          });
        }
      }

      onGuardado(doc);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Bloque selector de modo solo para Acta
  const selectorModoActa = tipo === 'acta' ? (
    <div className="selector-modo-acta">
      <strong>Modo del acta:</strong>
      <label>
        <input type="radio" checked={modoActa === 'borrador'} onChange={() => { setModoActa('borrador'); setQrDataURL(null); setDatosAcceso(null); }} />
        Borrador (uso interno, contraseñas en claro)
      </label>
      <label className={!puedeDefinitiva ? 'opcion-deshabilitada' : ''}>
        <input
          type="radio"
          checked={modoActa === 'definitiva'}
          onChange={() => setModoActa('definitiva')}
          disabled={!puedeDefinitiva}
        />
        Definitiva (entrega al cliente, contraseñas censuradas + QR)
        {!puedeDefinitiva && (
          <small style={{ display: 'block', marginTop: 4 }}>
            · Disponible cuando el proyecto este en estado "Entregado y aceptado".{' '}
            <button type="button" onClick={ponerEnEntregado} className="btn-mini" style={{ marginLeft: 4 }}>
              Cambiar ahora
            </button>
          </small>
        )}
      </label>
      {esActaDefinitiva && datosAcceso && (
        <div className="info-acceso-generado">
          <div><strong>Codigo:</strong> {datosAcceso.codigo_aceptacion}</div>
          <div><strong>PIN:</strong> <code>{datosAcceso.pin}</code> {datosAcceso.email_resultado?.ok && <span style={{color:'#047857'}}>(enviado por email)</span>}</div>
          <div style={{ fontSize: 11, color: '#666', wordBreak: 'break-all' }}><strong>URL del QR:</strong> {datosAcceso.url_acceso}</div>
        </div>
      )}
      {esActaDefinitiva && !datosAcceso && (
        <div className="info-acceso-pendiente">
          Al firmar, se generara automaticamente un PIN de 5 digitos, un codigo QR y un codigo de aceptacion.
          {emailHab && cliente.email && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <input type="checkbox" checked={enviarEmailPin} onChange={(e) => setEnviarEmailPin(e.target.checked)} />
              Enviar PIN por email a {cliente.email}
            </label>
          )}
          {!cliente.email && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>El cliente no tiene email guardado. El PIN solo aparecera en tu panel.</div>}
          {cliente.email && !emailHab && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Email no configurado en Vercel. El PIN solo aparecera en tu panel.</div>}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{tipoInfo.nombre}</h3>
          <button onClick={onCerrar}>X</button>
        </div>

        {selectorModoActa}

        {esActaDefinitiva && (
          <PanelCredencialesActa
            cliente={cliente}
            accesosLocal={accesosLocal}
            onRecargar={recargarAccesosLocal}
          />
        )}

        {esActaDefinitiva && (
          <PanelMarcaActa
            cliente={cliente}
            archivos={archivosLocal}
            onClienteActualizado={(c) => {
              if (typeof onActualizarCliente === 'function') onActualizarCliente(c);
            }}
            onArchivosActualizados={recargarArchivosLocal}
          />
        )}

        {paso === 'preview' && (
          <>
            <div className="preview-doc" ref={ref} dangerouslySetInnerHTML={{ __html: html }}></div>
            {!logoDataURL && (
              <div className="aviso-logo-cargando">
                Cargando logo del documento... espera unos segundos antes de firmar para que aparezca en el PDF.
              </div>
            )}
            <div className="modal-acciones">
              <button onClick={descargarPDF}>Descargar PDF (sin firma)</button>
              <button onClick={() => guardarDocumento(false)} disabled={guardando}>Guardar sin firmar</button>
              <button onClick={() => setPaso('firma')} className="btn-principal" disabled={generandoAcceso || !logoDataURL}>
                {generandoAcceso ? 'Generando...' : (!logoDataURL ? 'Cargando logo...' : 'Pasar a firma')}
              </button>
            </div>
          </>
        )}

        {paso === 'firma' && (
          <>
            <h4>Firma del cliente {firmaURL && <span style={{ color: '#047857', fontSize: 13 }}>· firma capturada</span>}</h4>
            <FirmaCanvas key={paso + '-firma'} onChange={setFirmaURL} />
            <div className="preview-doc" ref={ref} dangerouslySetInnerHTML={{ __html: html }}></div>
            <div className="modal-acciones">
              <button onClick={() => { setFirmaURL(null); setPaso('preview'); }}>Volver y borrar firma</button>
              <button onClick={descargarPDF} disabled={!firmaURL}>Descargar PDF firmado</button>
              <button
                onClick={() => guardarDocumento(true)}
                disabled={!firmaURL || guardando || generandoAcceso}
                className="btn-principal"
              >
                {guardando || generandoAcceso ? 'Guardando...' : (esActaDefinitiva ? 'Firmar y generar QR/PIN' : 'Guardar firmado')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PanelMarcaActa({ cliente, archivos, onClienteActualizado, onArchivosActualizados }) {
  // El branding vive en cliente.branding_json. Editamos en local
  // y guardamos via api.clienteUpdate. Si llega un cliente nuevo del padre,
  // resyncronizamos con useEffect.
  const initialBranding = cliente.branding_json || {};
  const [branding, setBranding] = useState({
    tagline: initialBranding.tagline || '',
    colores: Array.isArray(initialBranding.colores) ? initialBranding.colores : [],
    tipografias: Array.isArray(initialBranding.tipografias) ? initialBranding.tipografias : [],
  });
  const [guardando, setGuardando] = useState(false);

  // Estado de los formularios inline
  const [nuevoColor, setNuevoColor] = useState({ nombre: '', hex: '#0d3b2e', uso: '' });
  const [mostrarColorForm, setMostrarColorForm] = useState(false);
  const [nuevaTipo, setNuevaTipo] = useState({ nombre: '', uso: '' });
  const [mostrarTipoForm, setMostrarTipoForm] = useState(false);

  useEffect(() => {
    const b = cliente.branding_json || {};
    setBranding({
      tagline: b.tagline || '',
      colores: Array.isArray(b.colores) ? b.colores : [],
      tipografias: Array.isArray(b.tipografias) ? b.tipografias : [],
    });
  }, [cliente.id, cliente.branding_json]);

  async function guardarBranding(nuevoBranding) {
    setGuardando(true);
    try {
      const actualizado = await api.clienteUpdate({ id: cliente.id, branding_json: nuevoBranding });
      setBranding({
        tagline: nuevoBranding.tagline || '',
        colores: Array.isArray(nuevoBranding.colores) ? nuevoBranding.colores : [],
        tipografias: Array.isArray(nuevoBranding.tipografias) ? nuevoBranding.tipografias : [],
      });
      if (typeof onClienteActualizado === 'function') onClienteActualizado(actualizado);
    } catch (err) {
      alert('Error guardando marca: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  function addColor(e) {
    e.preventDefault();
    if (!nuevoColor.hex) return;
    const nuevoBranding = { ...branding, colores: [...branding.colores, { ...nuevoColor }] };
    setNuevoColor({ nombre: '', hex: '#0d3b2e', uso: '' });
    setMostrarColorForm(false);
    guardarBranding(nuevoBranding);
  }

  function eliminarColor(i) {
    const nuevoBranding = { ...branding, colores: branding.colores.filter((_, idx) => idx !== i) };
    guardarBranding(nuevoBranding);
  }

  function addTipo(e) {
    e.preventDefault();
    if (!nuevaTipo.nombre.trim()) return;
    const nuevoBranding = { ...branding, tipografias: [...branding.tipografias, { ...nuevaTipo }] };
    setNuevaTipo({ nombre: '', uso: '' });
    setMostrarTipoForm(false);
    guardarBranding(nuevoBranding);
  }

  function eliminarTipo(i) {
    const nuevoBranding = { ...branding, tipografias: branding.tipografias.filter((_, idx) => idx !== i) };
    guardarBranding(nuevoBranding);
  }

  function guardarTagline() {
    guardarBranding({ ...branding });
  }

  async function toggleIncluir(archivo, incluir) {
    try {
      await api.archivoUpdate({ id: archivo.id, incluir_en_acta: incluir });
      if (typeof onArchivosActualizados === 'function') await onArchivosActualizados();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // Filtrar solo los archivos que son imagenes
  // Mostramos todos los archivos del cliente, no solo imagenes.
  // Asi Lazaro puede listar tambien PDFs, ZIPs, contratos auxiliares, etc.
  const imagenes = archivos || [];
  const seleccionadas = imagenes.filter(a => a.incluir_en_acta).length;

  return (
    <div className="panel-marca-acta">
      <div className="pma-header">
        <h4 style={{ margin: 0 }}>Marca y materiales graficos</h4>
        <span className="pma-contador">
          {branding.colores.length} colores · {branding.tipografias.length} fuentes · {seleccionadas} de {imagenes.length} archivos
        </span>
      </div>
      <p className="pma-explicacion">
        Anade la identidad visual del cliente y selecciona los logos o imagenes que quieres incluir en el PDF del Acta.
        Esta seccion convierte el documento en un dossier de marca completo.
      </p>

      {/* TAGLINE */}
      <div className="pma-bloque">
        <strong>Tagline / lema</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="text"
            value={branding.tagline}
            onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
            placeholder="Ej: Conecta, Vibra, Vive."
            style={{ flex: 1 }}
          />
          <button type="button" onClick={guardarTagline} disabled={guardando} className="btn-mini">Guardar</button>
        </div>
      </div>

      {/* COLORES */}
      <div className="pma-bloque">
        <div className="pma-bloque-header">
          <strong>Paleta de colores</strong>
          <button type="button" onClick={() => setMostrarColorForm(!mostrarColorForm)} className="btn-mini">
            {mostrarColorForm ? 'Cancelar' : '+ Anadir color'}
          </button>
        </div>
        {branding.colores.length > 0 && (
          <div className="pma-paleta">
            {branding.colores.map((col, i) => (
              <div key={i} className="pma-color-card">
                <div className="pma-color-muestra" style={{ background: col.hex }}></div>
                <div className="pma-color-info">
                  <strong>{col.nombre || col.hex}</strong>
                  <code>{col.hex}</code>
                  {col.uso && <small>{col.uso}</small>}
                </div>
                <button type="button" onClick={() => eliminarColor(i)} className="btn-peligro btn-mini">x</button>
              </div>
            ))}
          </div>
        )}
        {mostrarColorForm && (
          <form onSubmit={addColor} className="pma-form-inline">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label>Nombre
                <input value={nuevoColor.nombre} onChange={(e) => setNuevoColor({ ...nuevoColor, nombre: e.target.value })} placeholder="Verde principal" />
              </label>
              <label>Color
                <input type="color" value={nuevoColor.hex} onChange={(e) => setNuevoColor({ ...nuevoColor, hex: e.target.value })} style={{ width: 50, height: 36, padding: 2 }} />
              </label>
              <label>Hex
                <input value={nuevoColor.hex} onChange={(e) => setNuevoColor({ ...nuevoColor, hex: e.target.value })} style={{ width: 90, fontFamily: 'monospace' }} />
              </label>
              <label style={{ flex: 1, minWidth: 150 }}>Uso
                <input value={nuevoColor.uso} onChange={(e) => setNuevoColor({ ...nuevoColor, uso: e.target.value })} placeholder="Fondos, hero, botones" />
              </label>
              <button type="submit" className="btn-primary" disabled={guardando}>Guardar</button>
            </div>
          </form>
        )}
      </div>

      {/* TIPOGRAFIAS */}
      <div className="pma-bloque">
        <div className="pma-bloque-header">
          <strong>Tipografias</strong>
          <button type="button" onClick={() => setMostrarTipoForm(!mostrarTipoForm)} className="btn-mini">
            {mostrarTipoForm ? 'Cancelar' : '+ Anadir tipografia'}
          </button>
        </div>
        {branding.tipografias.length > 0 && (
          <ul className="pma-tipos">
            {branding.tipografias.map((tp, i) => (
              <li key={i}>
                <strong>{tp.nombre}</strong>
                {tp.uso && <span> · {tp.uso}</span>}
                <button type="button" onClick={() => eliminarTipo(i)} className="btn-peligro btn-mini">x</button>
              </li>
            ))}
          </ul>
        )}
        {mostrarTipoForm && (
          <form onSubmit={addTipo} className="pma-form-inline">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 200 }}>Nombre
                <input value={nuevaTipo.nombre} onChange={(e) => setNuevaTipo({ ...nuevaTipo, nombre: e.target.value })} placeholder="Bricolage Grotesque" required />
              </label>
              <label style={{ flex: 1, minWidth: 150 }}>Uso
                <input value={nuevaTipo.uso} onChange={(e) => setNuevaTipo({ ...nuevaTipo, uso: e.target.value })} placeholder="Titulos" />
              </label>
              <button type="submit" className="btn-primary" disabled={guardando}>Guardar</button>
            </div>
          </form>
        )}
      </div>

      {/* ARCHIVOS PARA INCLUIR EN LA LISTA DEL ACTA */}
      <div className="pma-bloque">
        <strong>Archivos a listar en el Acta</strong>
        <p style={{ fontSize: 11, color: '#666', margin: '4px 0 8px' }}>
          Marca los archivos que quieres que aparezcan en el Acta como lista de materiales entregados.
          Solo aparecen el nombre y el tamano, no se incrustan los archivos en el PDF.
        </p>
        {imagenes.length === 0 ? (
          <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
            No hay archivos en este cliente. Sube los logos, mockups o cualquier archivo entregado en la pestaña Archivos.
          </p>
        ) : (
          <ul className="pma-archivos-lista">
            {imagenes.map(img => (
              <li key={img.id} className={img.incluir_en_acta ? 'seleccionado' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!img.incluir_en_acta}
                    onChange={(e) => toggleIncluir(img, e.target.checked)}
                  />
                  <span className="pma-archivo-nombre">{img.nombre}</span>
                  <span className="pma-archivo-tamano">{(img.tamano / 1024).toFixed(0)} KB</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PanelCredencialesActa({ cliente, accesosLocal, onRecargar }) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [form, setForm] = useState({
    categoria: 'Email',
    etiqueta: '',
    url: '',
    usuario: '',
    password: '',
    notas: '',
  });
  const [guardandoCred, setGuardandoCred] = useState(false);
  const [verPwd, setVerPwd] = useState({}); // {accesoId: passwordTexto}

  // Sistema de desbloqueo: las contrasenas estan bloqueadas por defecto.
  // Para verlas hay que introducir la contrasena de entrada (la del login).
  // Una vez desbloqueadas, se mantienen accesibles 5 minutos en esta sesion.
  const UNLOCK_KEY = 'creds_unlock_until';
  const UNLOCK_MIN = 5;
  const [desbloqueado, setDesbloqueado] = useState(() => {
    const until = parseInt(sessionStorage.getItem(UNLOCK_KEY) || '0', 10);
    return until > Date.now();
  });
  const [pidiendoPwd, setPidiendoPwd] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [tiempoRestante, setTiempoRestante] = useState('');

  // Auto-bloqueo cuando expira el tiempo
  useEffect(() => {
    if (!desbloqueado) { setTiempoRestante(''); return; }
    const tick = () => {
      const until = parseInt(sessionStorage.getItem(UNLOCK_KEY) || '0', 10);
      const restante = until - Date.now();
      if (restante <= 0) {
        setDesbloqueado(false);
        setVerPwd({});
        sessionStorage.removeItem(UNLOCK_KEY);
        setTiempoRestante('');
        return;
      }
      const min = Math.floor(restante / 60000);
      const seg = Math.floor((restante % 60000) / 1000);
      setTiempoRestante(`${min}:${String(seg).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [desbloqueado]);

  function abrirDesbloqueo() {
    setPwdInput('');
    setPwdError('');
    setPidiendoPwd(true);
  }

  function confirmarDesbloqueo(e) {
    e.preventDefault();
    const pwdGuardada = getPassword();
    if (!pwdInput) {
      setPwdError('Introduce la contrasena');
      return;
    }
    if (pwdInput !== pwdGuardada) {
      setPwdError('Contrasena incorrecta');
      return;
    }
    const until = Date.now() + UNLOCK_MIN * 60 * 1000;
    sessionStorage.setItem(UNLOCK_KEY, String(until));
    setDesbloqueado(true);
    setPidiendoPwd(false);
    setPwdInput('');
    setPwdError('');
  }

  function bloquearAhora() {
    sessionStorage.removeItem(UNLOCK_KEY);
    setDesbloqueado(false);
    setVerPwd({});
  }

  let serviciosContratados = [];
  try {
    const sj = cliente.servicios_json;
    if (typeof sj === 'string') serviciosContratados = JSON.parse(sj || '[]');
    else if (Array.isArray(sj)) serviciosContratados = sj;
  } catch {}

  const grupos = {};
  (accesosLocal || []).forEach(a => {
    const k = a.categoria || 'Otros';
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(a);
  });
  const totalAccesos = (accesosLocal || []).length;

  function abrirForm(categoriaSugerida) {
    setForm({
      categoria: categoriaSugerida || 'Email',
      etiqueta: '',
      url: '',
      usuario: '',
      password: '',
      notas: '',
    });
    setAnadiendo(true);
  }

  async function guardarCred(e) {
    e.preventDefault();
    if (!form.etiqueta.trim()) {
      alert('Pon al menos una etiqueta para identificar el acceso');
      return;
    }
    setGuardandoCred(true);
    try {
      await api.accesoCreate({ ...form, cliente_id: cliente.id });
      setAnadiendo(false);
      await onRecargar();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardandoCred(false);
    }
  }

  async function eliminarCred(a) {
    if (!confirm('Eliminar el acceso "' + a.etiqueta + '"?')) return;
    try {
      await api.accesoDelete(a.id);
      await onRecargar();
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function togglePwd(accesoId) {
    if (!desbloqueado) {
      abrirDesbloqueo();
      return;
    }
    if (verPwd[accesoId]) {
      setVerPwd(prev => { const n = { ...prev }; delete n[accesoId]; return n; });
      return;
    }
    try {
      const lista = await api.accesosList(cliente.id, true);
      const a = lista.find(x => x.id === accesoId);
      if (a) setVerPwd(prev => ({ ...prev, [accesoId]: a.password || '(sin contrasena)' }));
    } catch (err) { alert('Error: ' + err.message); }
  }

  return (
    <div className="panel-credenciales-acta">
      <div className="pca-header">
        <h4 style={{ margin: 0 }}>Credenciales a entregar al cliente</h4>
        <span className="pca-contador">{totalAccesos} {totalAccesos === 1 ? 'credencial' : 'credenciales'}</span>
      </div>
      <p className="pca-explicacion">
        Estas credenciales aparecen en el QR del Acta. El cliente las vera tras escanear el QR e introducir el PIN.
        Anade aqui los accesos que has creado durante el proyecto (email corporativo, hosting, redes sociales, etc).
      </p>

      <div className="pca-bloqueo">
        {!desbloqueado ? (
          <button type="button" onClick={abrirDesbloqueo} className="btn-desbloquear">
            🔒 Desbloquear contrasenas
          </button>
        ) : (
          <div className="pca-desbloqueado">
            <span className="pca-estado-ok">✓ Desbloqueado · se bloquea en {tiempoRestante}</span>
            <button type="button" onClick={bloquearAhora} className="btn-bloquear-ahora">Bloquear ahora</button>
          </div>
        )}
      </div>

      {serviciosContratados.length > 0 && (
        <div className="pca-servicios">
          <strong>Servicios contratados:</strong>{' '}
          {serviciosContratados.map((s, i) => (
            <span key={i} className="pca-chip">{typeof s === 'string' ? s : (s.nombre || s.titulo || 'Servicio')}</span>
          ))}
        </div>
      )}

      <div className="pca-grupos">
        {CATEGORIAS_ACCESO.map(cat => {
          const items = grupos[cat] || [];
          return (
            <div key={cat} className="pca-grupo">
              <div className="pca-grupo-cabecera">
                <strong>{cat}</strong>
                <span className="pca-mini-contador">{items.length}</span>
                <button type="button" onClick={() => abrirForm(cat)} className="btn-mini">+ Anadir</button>
              </div>
              {items.length > 0 && (
                <ul className="pca-lista">
                  {items.map(a => (
                    <li key={a.id}>
                      <div className="pca-item-principal">
                        <strong>{a.etiqueta}</strong>
                        {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="pca-url">{a.url}</a>}
                      </div>
                      <div className="pca-item-detalle">
                        {a.usuario && <span>Usuario: <code>{a.usuario}</code></span>}
                        {a.tiene_password ? (
                          <span className="pca-pwd-fila">
                            Pwd: {desbloqueado && verPwd[a.id]
                              ? <code className="pca-pwd-visible">{verPwd[a.id]}</code>
                              : <code className="pca-pwd-oculta">●●●●●●●●</code>}
                            <button type="button" onClick={() => togglePwd(a.id)} className="btn-ver-pwd">
                              {!desbloqueado ? '🔒 Ver' : (verPwd[a.id] ? 'Ocultar' : '👁 Ver')}
                            </button>
                          </span>
                        ) : <span style={{color:'#dc2626'}}>sin contrasena</span>}
                      </div>
                      {a.notas && <div className="pca-notas">{a.notas}</div>}
                      <div className="pca-item-acciones">
                        <button type="button" onClick={() => eliminarCred(a)} className="btn-peligro btn-mini">Eliminar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {anadiendo && (
        <form onSubmit={guardarCred} className="pca-form-inline">
          <h4 style={{ margin: '0 0 8px' }}>Nueva credencial</h4>
          <div className="pca-form-fila">
            <label>Categoria
              <select value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})}>
                {CATEGORIAS_ACCESO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Etiqueta *
              <input value={form.etiqueta} onChange={(e) => setForm({...form, etiqueta: e.target.value})} placeholder="Ej: Gmail principal del negocio" required />
            </label>
          </div>
          <div className="pca-form-fila">
            <label>URL
              <input value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://..." />
            </label>
            <label>Usuario / email
              <input value={form.usuario} onChange={(e) => setForm({...form, usuario: e.target.value})} />
            </label>
          </div>
          <div className="pca-form-fila">
            <label>Contrasena
              <input type="text" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="Se cifra antes de guardar" />
            </label>
            <label>Notas
              <input value={form.notas} onChange={(e) => setForm({...form, notas: e.target.value})} />
            </label>
          </div>
          <div className="pca-form-acciones">
            <button type="button" onClick={() => setAnadiendo(false)} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardandoCred}>
              {guardandoCred ? 'Guardando...' : 'Guardar credencial'}
            </button>
          </div>
        </form>
      )}

      {pidiendoPwd && (
        <div className="modal-overlay" onClick={() => setPidiendoPwd(false)}>
          <div className="modal modal-pequeno" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Verificar identidad</h3>
            <p style={{ fontSize: 13, color: '#555' }}>
              Para mostrar las contrasenas, introduce tu contrasena de entrada (la misma que usas para acceder al sistema).
              Las contrasenas quedaran visibles durante {UNLOCK_MIN} minutos.
            </p>
            <form onSubmit={confirmarDesbloqueo}>
              <input
                type="password"
                value={pwdInput}
                onChange={(e) => { setPwdInput(e.target.value); setPwdError(''); }}
                placeholder="Contrasena de entrada"
                autoFocus
                style={{ width: '100%' }}
              />
              {pwdError && <div className="alerta alerta-error" style={{ marginTop: 8 }}>{pwdError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPidiendoPwd(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-desbloquear" disabled={!pwdInput}>
                  🔓 Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalVerDoc({ documento, cliente, emailHab, onCerrar }) {
  const [enviando, setEnviando] = useState(false);
  const ref = useRef(null);

  async function descargar() {
    if (!ref.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf().set({
      margin: 0,
      filename: `${documento.nombre}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(ref.current).save();
  }

  async function enviarPorEmail() {
    if (!cliente.email) { alert('El cliente no tiene email guardado.'); return; }
    if (!confirm(`Enviar el documento al email del cliente (${cliente.email})?`)) return;
    setEnviando(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const blob = await html2pdf().set({
        margin: 0, filename: `${documento.nombre}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(ref.current).outputPdf('blob');
      const base64 = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      await api.enviarActa({
        destinatario: cliente.email,
        asunto: `${documento.nombre}`,
        mensaje_html: `<p>Hola ${cliente.nombre},</p><p>Adjunto encontraras el documento "${documento.nombre}".</p><p>Cualquier duda, respondeme a este email.</p><p>Un saludo.</p>`,
        pdf_base64: base64,
        pdf_nombre: `${documento.nombre}.pdf`,
      });
      alert('Email enviado correctamente.');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{documento.nombre}</h3>
          <button onClick={onCerrar}>X</button>
        </div>
        <div className="preview-doc" ref={ref} dangerouslySetInnerHTML={{ __html: documento.contenido_html }}></div>
        <div className="modal-acciones">
          <button onClick={descargar}>Descargar PDF</button>
          <button onClick={enviarPorEmail} disabled={!emailHab || !cliente.email || enviando} title={!emailHab ? 'Email no configurado en Vercel' : (!cliente.email ? 'El cliente no tiene email' : '')}>
            {enviando ? 'Enviando...' : 'Enviar por email al cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PANEL: ARCHIVOS
// =============================================================
function PanelArchivos({ cliente, archivos, setArchivos }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);

  async function subir(file) {
    if (!file) return;
    if (file.size > 9 * 1024 * 1024) { alert('El archivo es muy grande (max 9 MB).'); return; }
    setSubiendo(true);
    try {
      const base64 = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.readAsDataURL(file);
      });
      const nuevo = await api.archivoUpload({
        cliente_id: cliente.id,
        nombre: file.name,
        tipo: file.type || 'application/octet-stream',
        contenido_base64: base64,
      });
      setArchivos([nuevo, ...archivos]);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function descargar(a) {
    try { await api.archivoDescargar(a.id, a.nombre); }
    catch (err) { alert('Error: ' + err.message); }
  }

  async function eliminar(a) {
    if (!confirm('Eliminar el archivo "' + a.nombre + '"?')) return;
    try {
      await api.archivoDelete(a.id);
      setArchivos(archivos.filter(x => x.id !== a.id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  return (
    <div>
      <h3>Archivos del cliente</h3>
      <p style={{ color: '#666' }}>Briefings, logos, materiales, documentos firmados externamente, etc.</p>
      <div>
        <input ref={inputRef} type="file" onChange={(e) => subir(e.target.files[0])} disabled={subiendo} />
        {subiendo && <span style={{ marginLeft: 12 }}>Subiendo...</span>}
      </div>

      {archivos.length === 0 ? (
        <p style={{ color: '#666', marginTop: 16 }}>No hay archivos subidos.</p>
      ) : (
        <table className="tabla-archivos">
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamano</th><th>Subido</th><th></th></tr></thead>
          <tbody>
            {archivos.map(a => (
              <tr key={a.id}>
                <td>{a.nombre}</td>
                <td>{a.tipo}</td>
                <td>{(a.tamano / 1024).toFixed(1)} KB</td>
                <td>{new Date(a.creado_en).toLocaleDateString('es-ES')}</td>
                <td>
                  <button onClick={() => descargar(a)}>Descargar</button>
                  <button onClick={() => eliminar(a)} className="btn-peligro">X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =============================================================
// PANEL: ENTREGABLES (Acta Progresiva)
// =============================================================
function PanelEntregables({ cliente, entregables, setEntregables, setCliente, recargar }) {
  const [editando, setEditando] = useState(null);
  const [accesosActaInfo, setAccesosActaInfo] = useState([]);

  useEffect(() => {
    api.accesosActaList(cliente.id, false).then(setAccesosActaInfo).catch(() => {});
  }, [cliente.id]);

  async function aplicarPlantilla(sustituir) {
    const msg = sustituir
      ? 'Esto borrara los entregables actuales y creara los de plantilla. Continuar?'
      : 'Esto anadira los entregables de plantilla a los que ya tienes. Continuar?';
    if (!confirm(msg)) return;
    try {
      await api.aplicarEntregables(cliente.id, sustituir);
      await recargar();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function toggleCompletado(en) {
    try {
      const actualizado = await api.entregableUpdate({ ...en, completado: !en.completado });
      setEntregables(entregables.map(x => x.id === en.id ? actualizado : x));
      // Recargar cliente para ver el nuevo % de avance
      const c = await api.clienteGet(cliente.id);
      setCliente(c);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function eliminar(en) {
    if (!confirm('Eliminar el entregable "' + en.nombre + '"?')) return;
    try {
      await api.entregableDelete(en.id);
      setEntregables(entregables.filter(x => x.id !== en.id));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function guardarEntregable(datos) {
    try {
      let saved;
      if (datos.id) {
        saved = await api.entregableUpdate(datos);
        setEntregables(entregables.map(x => x.id === datos.id ? saved : x));
      } else {
        saved = await api.entregableCreate({
          ...datos,
          cliente_id: cliente.id,
          orden: entregables.length + 1,
        });
        setEntregables([...entregables, saved]);
      }
      setEditando(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // Agrupar por categoria
  const grupos = useMemo(() => {
    const g = {};
    entregables.forEach(e => {
      const k = e.categoria || 'General';
      if (!g[k]) g[k] = [];
      g[k].push(e);
    });
    return g;
  }, [entregables]);

  const completados = entregables.filter(e => e.completado).length;
  const total = entregables.length;

  return (
    <div>
      <div className="cabecera-panel">
        <div>
          <h3 style={{ margin: 0 }}>Entregables del proyecto</h3>
          {total > 0 && (
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {completados} de {total} completados ({Math.round((completados / total) * 100)}%)
            </div>
          )}
        </div>
        <div className="cabecera-acciones">
          <button onClick={() => setEditando({ nombre: '', categoria: 'General', completado: false })}>+ Nuevo entregable</button>
        </div>
      </div>

      {entregables.length === 0 ? (
        <div className="estado-vacio">
          <p>Aun no hay entregables definidos para este proyecto. Puedes generar la lista automaticamente segun los servicios contratados, o anadir uno por uno.</p>
          <button onClick={() => aplicarPlantilla(false)} className="btn-principal">Generar entregables desde servicios</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => aplicarPlantilla(false)}>Anadir entregables desde servicios</button>
            <button onClick={() => aplicarPlantilla(true)} style={{ background: '#ef4444' }}>Sustituir todo desde servicios</button>
          </div>

          {Object.keys(grupos).map(cat => (
            <div key={cat} className="grupo-entregables">
              <h4>{cat}</h4>
              {grupos[cat].sort((a, b) => a.orden - b.orden).map(en => (
                <div key={en.id} className={`entregable-fila ${en.completado ? 'completado' : ''}`}>
                  <input
                    type="checkbox"
                    checked={en.completado}
                    onChange={() => toggleCompletado(en)}
                  />
                  <div className="entregable-info">
                    <div className="entregable-nombre">{en.nombre}</div>
                    {en.fecha_completado && (
                      <div className="entregable-fecha">Completado el {new Date(en.fecha_completado).toLocaleDateString('es-ES')}</div>
                    )}
                    {en.notas && <div className="entregable-notas">{en.notas}</div>}
                  </div>
                  <button onClick={() => setEditando(en)}>Editar</button>
                  <button onClick={() => eliminar(en)} className="btn-peligro">X</button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {accesosActaInfo.length > 0 && (
        <div style={{ marginTop: 30, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Acceso al acta firmada (QR + PIN)</h4>
          {accesosActaInfo.map(a => <FilaAccesoActa key={a.id} acceso={a} clienteId={cliente.id} onCambio={() => api.accesosActaList(cliente.id, false).then(setAccesosActaInfo)} />)}
        </div>
      )}

      {editando && <ModalEntregable inicial={editando} onGuardar={guardarEntregable} onCancelar={() => setEditando(null)} />}
    </div>
  );
}

function FilaAccesoActa({ acceso, clienteId, onCambio }) {
  const [pinVisible, setPinVisible] = useState(null);
  const [reenviando, setReenviando] = useState(false);

  async function verPIN() {
    if (!confirm('Vas a mostrar el PIN del cliente. Asegurate de que nadie ve la pantalla. Continuar?')) return;
    try {
      const lista = await api.accesosActaList(clienteId, true);
      const f = lista.find(x => x.id === acceso.id);
      if (f) setPinVisible(f.pin);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function reenviarAlCliente() {
    if (!confirm('Reenviar el email con el PIN al cliente (al mismo email guardado)?')) return;
    setReenviando(true);
    try {
      const r = await api.reenviarPinActa(acceso.id, '');
      alert('Email reenviado a ' + r.destino);
      onCambio();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setReenviando(false);
    }
  }

  async function reenviarAOtroEmail() {
    const otro = prompt('Email destino (dejalo en blanco para cancelar):');
    if (!otro || !otro.trim()) return;
    setReenviando(true);
    try {
      const r = await api.reenviarPinActa(acceso.id, otro.trim());
      alert('Email reenviado a ' + r.destino);
      onCambio();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setReenviando(false);
    }
  }

  async function desbloquear() {
    if (!confirm('Desbloquear el acceso del cliente (resetear intentos fallidos)?')) return;
    try {
      await api.accesoActaAccion(acceso.id, 'desbloquear');
      onCambio();
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function desactivar() {
    if (!confirm('Desactivar este acceso? El cliente ya no podra ver sus contraseñas con este enlace.')) return;
    try {
      await api.accesoActaAccion(acceso.id, 'desactivar');
      onCambio();
    } catch (err) { alert('Error: ' + err.message); }
  }

  const bloqueado = acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta) > new Date();
  const url = `${window.location.origin}/acceso/${acceso.token}`;

  return (
    <div className="acceso-acta-fila">
      <div>
        <strong>{acceso.codigo_aceptacion}</strong>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#666' }}>
          {new Date(acceso.creado_en).toLocaleDateString('es-ES')}
        </span>
        {!acceso.activo && <span className="pill" style={{ background: '#ef4444', color: '#fff', marginLeft: 6 }}>Desactivado</span>}
        {bloqueado && <span className="pill" style={{ background: '#f59e0b', color: '#fff', marginLeft: 6 }}>Bloqueado</span>}
      </div>
      <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all', marginTop: 4 }}>{url}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Visitas: {acceso.visitas} · Intentos fallidos: {acceso.intentos_fallidos} · Email: {acceso.email_enviado ? 'enviado' : 'no enviado'}
      </div>
      {pinVisible && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
          PIN: {pinVisible}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={verPIN}>Ver PIN</button>
        <button onClick={() => navigator.clipboard.writeText(url)}>Copiar URL</button>
        {acceso.activo && (
          <button onClick={reenviarAlCliente} disabled={reenviando}>
            {reenviando ? 'Enviando...' : 'Reenviar al cliente'}
          </button>
        )}
        {acceso.activo && (
          <button onClick={reenviarAOtroEmail} disabled={reenviando}>
            Reenviar a otro email
          </button>
        )}
        {bloqueado && <button onClick={desbloquear}>Desbloquear</button>}
        {acceso.activo && <button onClick={desactivar} className="btn-peligro">Desactivar</button>}
      </div>
    </div>
  );
}

function ModalEntregable({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({ ...inicial });
  function up(k, v) { setF({ ...f, [k]: v }); }
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? 'Editar entregable' : 'Nuevo entregable'}</h3>
        <label>Nombre
          <input value={f.nombre || ''} onChange={(e) => up('nombre', e.target.value)} autoFocus />
        </label>
        <label>Categoria
          <input value={f.categoria || 'General'} onChange={(e) => up('categoria', e.target.value)} />
        </label>
        <label>Notas
          <textarea rows="2" value={f.notas || ''} onChange={(e) => up('notas', e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!f.completado} onChange={(e) => up('completado', e.target.checked)} />
          Marcar como completado
        </label>
        <div className="modal-acciones">
          <button onClick={onCancelar}>Cancelar</button>
          <button onClick={() => onGuardar(f)} disabled={!f.nombre}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PANEL: EMAILS DEL CLIENTE
// =============================================================
function PanelEmailsCliente({ cliente }) {
  const [emails, setEmails] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verEmail, setVerEmail] = useState(null);
  const [nuevoEmail, setNuevoEmail] = useState(false);

  useEffect(() => { cargar(); }, [cliente.id]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.emailsList(cliente.id, 100);
      setEmails(data);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    if (!confirm('Eliminar este email del historial?')) return;
    try {
      await api.emailDelete(id);
      setEmails(emails.filter(e => e.id !== id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  if (cargando) return <div>Cargando...</div>;

  return (
    <div>
      <div className="cabecera-panel">
        <h3 style={{ margin: 0 }}>Emails enviados al cliente</h3>
        <button onClick={() => setNuevoEmail(true)} className="btn-principal">+ Nuevo email</button>
      </div>

      {emails.length === 0 ? (
        <div className="estado-vacio">
          <p>No has enviado ningun email a este cliente todavia.</p>
          <button onClick={() => setNuevoEmail(true)}>Enviar el primer email</button>
        </div>
      ) : (
        <table className="tabla-docs">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Asunto</th>
              <th>Para</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {emails.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.enviado_en).toLocaleString('es-ES', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                })}</td>
                <td>{e.asunto}</td>
                <td style={{ fontSize: 12 }}>{e.destinatario}</td>
                <td>
                  {e.exitoso ? (
                    <span className="pill" style={{ background: '#dcfce7', color: '#166534' }}>Enviado</span>
                  ) : (
                    <span className="pill" style={{ background: '#fee2e2', color: '#991b1b' }} title={e.error}>Fallo</span>
                  )}
                  {Array.isArray(e.archivos_adjuntos) && e.archivos_adjuntos.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#666' }} title={e.archivos_adjuntos.map(a => a.nombre).join(', ')}>
                      📎 {e.archivos_adjuntos.length}
                    </span>
                  )}
                </td>
                <td>
                  <button onClick={() => setVerEmail(e)}>Ver</button>
                  <button onClick={() => eliminar(e.id)} className="btn-peligro">X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {nuevoEmail && (
        <EmailCompositor
          cliente={cliente}
          onCerrar={() => setNuevoEmail(false)}
          onEnviado={cargar}
        />
      )}

      {verEmail && (
        <div className="modal-overlay" onClick={() => setVerEmail(null)}>
          <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{verEmail.asunto}</h3>
              <button onClick={() => setVerEmail(null)}>X</button>
            </div>
            <div className="ver-email-meta">
              <div><strong>Para:</strong> {verEmail.destinatario}</div>
              {verEmail.cc && <div><strong>Cc:</strong> {verEmail.cc}</div>}
              <div><strong>Enviado:</strong> {new Date(verEmail.enviado_en).toLocaleString('es-ES')}</div>
              <div><strong>Estado:</strong> {verEmail.exitoso ? 'Entregado' : 'Fallo: ' + verEmail.error}</div>
              {Array.isArray(verEmail.archivos_adjuntos) && verEmail.archivos_adjuntos.length > 0 && (
                <div>
                  <strong>Adjuntos:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {verEmail.archivos_adjuntos.map((a, i) => (
                      <li key={i}>{a.nombre} ({(a.tamano / 1024).toFixed(1)} KB)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="ver-email-cuerpo">
              {verEmail.cuerpo_html ? (
                <iframe
                  title="contenido-email"
                  srcDoc={verEmail.cuerpo_html}
                  style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 4 }}
                />
              ) : (
                <p style={{ color: '#666' }}>(Contenido no disponible)</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
