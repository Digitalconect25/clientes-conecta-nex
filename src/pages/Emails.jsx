import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import EmailCompositor from '../components/EmailCompositor.jsx';

export default function Emails() {
  const [seccion, setSeccion] = useState('historial'); // historial | plantillas
  const [emails, setEmails] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [editando, setEditando] = useState(null); // plantilla en edicion
  const [nuevoEmail, setNuevoEmail] = useState(false);
  const [verEmail, setVerEmail] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [e, p] = await Promise.all([
        api.emailsList(null, 100),
        api.emailPlantillasList(),
      ]);
      setEmails(e);
      setPlantillas(p);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminarEmail(id) {
    if (!confirm('Eliminar este email del historial? El email enviado no se puede revertir.')) return;
    try {
      await api.emailDelete(id);
      setEmails(emails.filter(e => e.id !== id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function eliminarPlantilla(id) {
    if (!confirm('Eliminar esta plantilla?')) return;
    try {
      await api.emailPlantillaDelete(id);
      setPlantillas(plantillas.filter(p => p.id !== id));
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function guardarPlantilla(p) {
    try {
      let saved;
      if (p.id) {
        saved = await api.emailPlantillaUpdate(p);
        setPlantillas(plantillas.map(x => x.id === p.id ? saved : x));
      } else {
        saved = await api.emailPlantillaCreate(p);
        setPlantillas([...plantillas, saved]);
      }
      setEditando(null);
    } catch (err) { alert('Error: ' + err.message); }
  }

  if (cargando) return <div>Cargando...</div>;

  return (
    <div>
      <div className="cabecera-panel">
        <h2 style={{ margin: 0 }}>Emails</h2>
        <button onClick={() => setNuevoEmail(true)} className="btn-principal">+ Nuevo email</button>
      </div>

      <div className="pestanas">
        <button className={`pestana ${seccion === 'historial' ? 'activa' : ''}`} onClick={() => setSeccion('historial')}>
          Historial ({emails.length})
        </button>
        <button className={`pestana ${seccion === 'plantillas' ? 'activa' : ''}`} onClick={() => setSeccion('plantillas')}>
          Plantillas ({plantillas.length})
        </button>
      </div>

      {seccion === 'historial' && (
        <div className="contenido-pestana">
          {emails.length === 0 ? (
            <p style={{ color: '#666' }}>No has enviado ningun email aun.</p>
          ) : (
            <table className="tabla-docs">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Para</th>
                  <th>Asunto</th>
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
                    <td>{e.cliente_nombre || '-'}</td>
                    <td style={{ fontSize: 12 }}>{e.destinatario}</td>
                    <td>{e.asunto}</td>
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
                      <button onClick={() => eliminarEmail(e.id)} className="btn-peligro">X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {seccion === 'plantillas' && (
        <div className="contenido-pestana">
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setEditando({ nombre: '', categoria: 'General', asunto: '', cuerpo_html: '<p>Tu mensaje</p>' })}>
              + Nueva plantilla
            </button>
          </div>

          {plantillas.length === 0 ? (
            <p style={{ color: '#666' }}>No hay plantillas creadas todavia.</p>
          ) : (
            <div className="grid-plantillas">
              {plantillas.map(p => (
                <div key={p.id} className="card-plantilla">
                  <div className="card-plantilla-cabecera">
                    <strong>{p.nombre}</strong>
                    <span className="pill">{p.categoria}</span>
                  </div>
                  <div className="card-plantilla-asunto">{p.asunto}</div>
                  {p.descripcion && <div className="card-plantilla-desc">{p.descripcion}</div>}
                  <div className="card-plantilla-acciones">
                    <button onClick={() => setEditando(p)}>Editar</button>
                    <button onClick={() => eliminarPlantilla(p.id)} className="btn-peligro">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editando && (
        <ModalPlantilla
          inicial={editando}
          onGuardar={guardarPlantilla}
          onCancelar={() => setEditando(null)}
        />
      )}

      {nuevoEmail && (
        <EmailCompositor
          cliente={null}
          onCerrar={() => setNuevoEmail(false)}
          onEnviado={cargar}
        />
      )}

      {verEmail && <ModalVerEmail email={verEmail} onCerrar={() => setVerEmail(null)} />}
    </div>
  );
}

function ModalPlantilla({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({ ...inicial });
  function up(k, v) { setF({ ...f, [k]: v }); }
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{f.id ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
          <button onClick={onCancelar}>X</button>
        </div>
        <label>Nombre
          <input value={f.nombre || ''} onChange={(e) => up('nombre', e.target.value)} autoFocus />
        </label>
        <label>Categoria
          <input value={f.categoria || 'General'} onChange={(e) => up('categoria', e.target.value)} list="categorias-plantilla" />
          <datalist id="categorias-plantilla">
            <option value="Inicio" />
            <option value="Pagos" />
            <option value="Seguimiento" />
            <option value="Entrega" />
            <option value="General" />
          </datalist>
        </label>
        <label>Descripcion (opcional)
          <input value={f.descripcion || ''} onChange={(e) => up('descripcion', e.target.value)} placeholder="Para que sirve esta plantilla" />
        </label>
        <label>Asunto
          <input value={f.asunto || ''} onChange={(e) => up('asunto', e.target.value)} placeholder="Asunto del email (admite variables)" />
        </label>
        <label>Cuerpo HTML
          <textarea
            rows="12"
            value={f.cuerpo_html || ''}
            onChange={(e) => up('cuerpo_html', e.target.value)}
            placeholder="<p>Hola {{cliente_nombre}}...</p>"
          />
        </label>
        <div className="ayuda-variables">
          <strong>Variables:</strong>
          <code>{'{{cliente_nombre}}'}</code>
          <code>{'{{numero_contrato}}'}</code>
          <code>{'{{total}}'}</code>
          <code>{'{{emisor_nombre}}'}</code>
          <code>{'{{fecha_hoy}}'}</code>
        </div>
        <div className="modal-acciones">
          <button onClick={onCancelar}>Cancelar</button>
          <button
            onClick={() => onGuardar(f)}
            disabled={!f.nombre || !f.asunto || !f.cuerpo_html}
            className="btn-principal"
          >
            Guardar plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalVerEmail({ email, onCerrar }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-grande" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{email.asunto}</h3>
          <button onClick={onCerrar}>X</button>
        </div>
        <div className="ver-email-meta">
          <div><strong>Para:</strong> {email.destinatario}</div>
          {email.cc && <div><strong>Cc:</strong> {email.cc}</div>}
          <div><strong>Enviado:</strong> {new Date(email.enviado_en).toLocaleString('es-ES')}</div>
          <div><strong>Estado:</strong> {email.exitoso ? 'Entregado' : 'Fallo: ' + email.error}</div>
          {Array.isArray(email.archivos_adjuntos) && email.archivos_adjuntos.length > 0 && (
            <div>
              <strong>Adjuntos:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {email.archivos_adjuntos.map((a, i) => (
                  <li key={i}>{a.nombre} ({(a.tamano / 1024).toFixed(1)} KB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="ver-email-cuerpo">
          {email.cuerpo_html ? (
            <iframe
              title="contenido-email"
              srcDoc={email.cuerpo_html}
              style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 4 }}
            />
          ) : (
            <p style={{ color: '#666' }}>(Contenido no disponible)</p>
          )}
        </div>
      </div>
    </div>
  );
}
