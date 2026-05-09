import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros, generarPorTipo, TIPOS_DOC } from '../lib/contratos.js';
import FirmaCanvas from '../components/FirmaCanvas.jsx';

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
  const [pestana, setPestana] = useState('datos');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    setCargando(true);
    try {
      const [c, e, s, p, f, ac, d, ar] = await Promise.all([
        api.clienteGet(id),
        api.emisorGet(),
        api.serviciosList(),
        api.pagosList(id),
        api.fasesList(id),
        api.accesosList(id),
        api.documentosList(id),
        api.archivosList(id),
      ]);
      setCliente(c);
      setEmisor(e);
      setServicios(s);
      setPagos(p);
      setFases(f);
      setAccesos(ac);
      setDocumentos(d);
      setArchivos(ar);
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
          ['pagos', 'Pagos'],
          ['accesos', 'Accesos'],
          ['documentos', 'Documentos'],
          ['archivos', 'Archivos'],
        ].map(([k, l]) => (
          <button key={k} className={`pestana ${pestana === k ? 'activa' : ''}`} onClick={() => setPestana(k)}>{l}</button>
        ))}
      </div>

      <div className="contenido-pestana">
        {pestana === 'datos' && <PanelDatos cliente={cliente} guardar={guardarCliente} eliminar={eliminarCliente} />}
        {pestana === 'servicios' && <PanelServicios cliente={cliente} servicios={servicios} guardar={guardarCliente} />}
        {pestana === 'pipeline' && <PanelPipeline cliente={cliente} fases={fases} setFases={setFases} guardar={guardarCliente} recargar={cargar} />}
        {pestana === 'pagos' && <PanelPagos cliente={cliente} pagos={pagos} setPagos={setPagos} />}
        {pestana === 'accesos' && <PanelAccesos cliente={cliente} accesos={accesos} setAccesos={setAccesos} />}
        {pestana === 'documentos' && <PanelDocumentos cliente={cliente} emisor={emisor} documentos={documentos} accesos={accesos} archivos={archivos} setDocumentos={setDocumentos} setArchivos={setArchivos} setCliente={setCliente} guardar={guardarCliente} />}
        {pestana === 'archivos' && <PanelArchivos cliente={cliente} archivos={archivos} setArchivos={setArchivos} />}
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

  async function eliminar(p) {
    if (!confirm('Eliminar este pago?')) return;
    try {
      await api.pagoDelete(p.id);
      setPagos(pagos.filter(x => x.id !== p.id));
    } catch (err) { alert('Error: ' + err.message); }
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
      <button onClick={() => setEditando({ concepto: '', importe: 0, estado: 'Pendiente' })}>+ Nuevo pago</button>

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
function PanelDocumentos({ cliente, emisor, documentos, accesos, archivos, setDocumentos, setArchivos, setCliente, guardar }) {
  const [previsualizando, setPrevisualizando] = useState(null);
  const [tipoNuevo, setTipoNuevo] = useState(null);
  const [emailHab, setEmailHab] = useState(false);

  useEffect(() => {
    api.emailEstado().then(r => setEmailHab(r.habilitado)).catch(() => setEmailHab(false));
  }, []);

  async function abrirNuevo(tipo) {
    if (tipo === 'acta') {
      // Para el acta, cargamos accesos con passwords descifradas para incluirlas
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
        {TIPOS_DOC.map(t => {
          const habilitado = !t.soloEntregado || cliente.estado_proyecto === 'Entregado y aceptado';
          const titulo = !habilitado ? 'Disponible cuando el proyecto este en estado "Entregado y aceptado"' : '';
          return (
            <button
              key={t.id}
              onClick={() => abrirNuevo(t.id)}
              disabled={!habilitado}
              title={titulo}
            >
              + {t.nombre}
            </button>
          );
        })}
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
          emailHab={emailHab}
          onGuardado={async (doc) => {
            setDocumentos([doc, ...documentos]);
            setTipoNuevo(null);
            // Si se firmo, recargar cliente Y archivos para reflejar la firma
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

function ModalGenerarDoc({ tipo, cliente, emisor, accesos, archivos, emailHab, onGuardado, onActualizarCliente, onCerrar }) {
  const [paso, setPaso] = useState('preview'); // preview | firma
  const [firmaURL, setFirmaURL] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const ref = useRef(null);

  const tipoInfo = TIPOS_DOC.find(t => t.id === tipo);
  const html = useMemo(
    () => generarPorTipo(tipo, { ...cliente, fecha_firma: firmaURL ? new Date().toISOString() : cliente.fecha_firma }, emisor, firmaURL, { accesos, archivos }),
    [tipo, cliente, emisor, firmaURL, accesos, archivos]
  );

  async function descargarPDF(firmado) {
    if (!ref.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = {
      margin: 0,
      filename: `${tipoInfo.nombre.toLowerCase().replace(/ /g, '-')}-${cliente.numero_contrato || cliente.numero_cliente}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(ref.current).save();
  }

  async function guardarDocumento(firmado) {
    setGuardando(true);
    try {
      const doc = await api.documentoCreate({
        cliente_id: cliente.id,
        tipo,
        nombre: `${tipoInfo.nombre} - ${cliente.nombre}`,
        contenido_html: html,
        firmado,
      });

      // Si esta firmado, hacemos dos cosas extra para no perder la firma:
      // 1. Guardar la firma como archivo PNG independiente en la pestaña Archivos
      // 2. Si es Hoja de Encargo o Contrato, marcar al cliente como Firmado
      if (firmado && firmaURL) {
        // 1. Subir la firma como archivo PNG
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
          // No bloqueamos el guardado del documento por un fallo al subir el archivo
          console.error('No se pudo guardar la firma como archivo:', errArch.message);
        }

        // 2. Si es Hoja o Contrato, marcar cliente como firmado
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

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{tipoInfo.nombre}</h3>
          <button onClick={onCerrar}>X</button>
        </div>

        {paso === 'preview' && (
          <>
            <div className="preview-doc" ref={ref} dangerouslySetInnerHTML={{ __html: html }}></div>
            <div className="modal-acciones">
              <button onClick={() => descargarPDF(false)}>Descargar PDF (sin firma)</button>
              <button onClick={() => guardarDocumento(false)} disabled={guardando}>Guardar sin firmar</button>
              <button onClick={() => setPaso('firma')} className="btn-principal">Pasar a firma</button>
            </div>
          </>
        )}

        {paso === 'firma' && (
          <>
            <h4>Firma del cliente</h4>
            <FirmaCanvas onChange={setFirmaURL} />
            <div className="preview-doc" dangerouslySetInnerHTML={{ __html: html }}></div>
            <div className="modal-acciones">
              <button onClick={() => setPaso('preview')}>Volver</button>
              <button onClick={() => descargarPDF(true)} disabled={!firmaURL}>Descargar PDF firmado</button>
              <button onClick={() => guardarDocumento(true)} disabled={!firmaURL || guardando} className="btn-principal">Guardar firmado</button>
            </div>
          </>
        )}
      </div>
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
