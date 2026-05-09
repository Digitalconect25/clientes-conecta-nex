import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.js';

// Modal compositor de email. Reutilizable desde:
// - La pagina global /emails (con cliente opcional)
// - La pestaña Emails del cliente (con cliente fijo)
//
// Props:
//   cliente: objeto cliente (puede venir vacio si es envio sin cliente)
//   plantillaInicial: id de plantilla a precargar
//   onCerrar: callback al cerrar
//   onEnviado: callback al enviar exitosamente
export default function EmailCompositor({ cliente, plantillaInicial, onCerrar, onEnviado }) {
  const [plantillas, setPlantillas] = useState([]);
  const [archivosCliente, setArchivosCliente] = useState([]);
  const [plantillaId, setPlantillaId] = useState(plantillaInicial || '');
  const [destinatario, setDestinatario] = useState(cliente?.email || '');
  const [cc, setCc] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [adjuntosCliente, setAdjuntosCliente] = useState([]); // array de ids
  const [adjuntosExtras, setAdjuntosExtras] = useState([]); // array {nombre, tipo, contenido_base64}
  const [previa, setPrevia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  useEffect(() => {
    api.emailPlantillasList().then(setPlantillas).catch(() => setPlantillas([]));
    if (cliente?.id) {
      api.archivosList(cliente.id).then(setArchivosCliente).catch(() => setArchivosCliente([]));
    }
  }, [cliente?.id]);

  // Cuando cambia la plantilla seleccionada, copiar su contenido
  useEffect(() => {
    if (!plantillaId) return;
    const p = plantillas.find(x => String(x.id) === String(plantillaId));
    if (p) {
      setAsunto(p.asunto);
      setCuerpo(p.cuerpo_html);
    }
  }, [plantillaId, plantillas]);

  function toggleArchivoCliente(id) {
    setAdjuntosCliente(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function subirArchivoExtra(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Archivo demasiado grande. Maximo 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      setAdjuntosExtras(prev => [...prev, {
        nombre: file.name,
        tipo: file.type || 'application/octet-stream',
        tamano: file.size,
        contenido_base64: base64,
      }]);
    };
    reader.readAsDataURL(file);
  }

  function quitarExtra(idx) {
    setAdjuntosExtras(prev => prev.filter((_, i) => i !== idx));
  }

  // Sustituye variables en preview (cliente del lado frontend)
  const cuerpoPrevia = useMemo(() => {
    if (!cliente) return cuerpo;
    const reemp = {
      cliente_nombre: cliente.nombre || '',
      cliente_email: cliente.email || '',
      cliente_nif: cliente.nif || '',
      cliente_telefono: cliente.telefono || '',
      cliente_numero: cliente.numero_cliente || '',
      numero_cliente: cliente.numero_cliente || '',
      numero_contrato: cliente.numero_contrato || cliente.numero_cliente || '',
      cliente_total: cliente.total ? Number(cliente.total).toFixed(2) + ' EUR' : '',
      total: cliente.total ? Number(cliente.total).toFixed(2) + ' EUR' : '',
      fecha_hoy: new Date().toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      }),
    };
    let r = cuerpo;
    Object.keys(reemp).forEach(k => {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      r = r.replace(re, reemp[k] || `[${k}]`);
    });
    return r;
  }, [cuerpo, cliente]);

  const asuntoPrevia = useMemo(() => {
    if (!cliente) return asunto;
    const reemp = {
      cliente_nombre: cliente.nombre || '',
      numero_contrato: cliente.numero_contrato || cliente.numero_cliente || '',
    };
    let r = asunto;
    Object.keys(reemp).forEach(k => {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      r = r.replace(re, reemp[k] || `[${k}]`);
    });
    return r;
  }, [asunto, cliente]);

  async function enviar() {
    setError('');
    if (!destinatario.trim()) { setError('Falta destinatario'); return; }
    if (!asunto.trim()) { setError('Falta asunto'); return; }
    if (!cuerpo.trim()) { setError('Falta cuerpo del mensaje'); return; }

    setEnviando(true);
    try {
      await api.emailEnviar({
        cliente_id: cliente?.id || null,
        plantilla_id: plantillaId || null,
        destinatario: destinatario.trim(),
        cc: cc.trim(),
        asunto,
        cuerpo_html: cuerpo,
        archivos_ids: adjuntosCliente,
        archivos_extras: adjuntosExtras,
      });
      setExito(true);
      setTimeout(() => {
        if (onEnviado) onEnviado();
        onCerrar();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-grande compositor-email" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Nuevo email</h3>
          <button onClick={onCerrar}>X</button>
        </div>

        {exito ? (
          <div className="exito-envio">
            <div style={{ fontSize: 40 }}>✓</div>
            <h3>Email enviado</h3>
            <p>El email se envio correctamente a {destinatario}</p>
          </div>
        ) : (
          <>
            <div className="compositor-grid">
              <div className="compositor-form">
                {plantillas.length > 0 && (
                  <label>
                    Plantilla
                    <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
                      <option value="">Sin plantilla (escribir desde cero)</option>
                      {plantillas.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.categoria})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Para
                  <input
                    type="email"
                    value={destinatario}
                    onChange={(e) => setDestinatario(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </label>

                <label>
                  Cc (opcional, separar con comas)
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="otro@email.com"
                  />
                </label>

                <label>
                  Asunto
                  <input
                    type="text"
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    placeholder="Asunto del email"
                  />
                </label>

                <label>
                  Mensaje (HTML basico admitido)
                  <textarea
                    rows="14"
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    placeholder="<p>Hola {{cliente_nombre}},</p><p>Tu mensaje aqui</p>"
                  />
                </label>

                <div className="ayuda-variables">
                  <strong>Variables disponibles:</strong>
                  <code>{'{{cliente_nombre}}'}</code>
                  <code>{'{{numero_contrato}}'}</code>
                  <code>{'{{total}}'}</code>
                  <code>{'{{emisor_nombre}}'}</code>
                  <code>{'{{fecha_hoy}}'}</code>
                </div>

                <div className="adjuntos-seccion">
                  <strong>Adjuntos</strong>

                  {archivosCliente.length > 0 && (
                    <>
                      <div className="ayuda-pequena">Archivos del cliente (selecciona los que quieras adjuntar):</div>
                      <div className="lista-archivos-cliente">
                        {archivosCliente.map(a => (
                          <label key={a.id} className="archivo-check">
                            <input
                              type="checkbox"
                              checked={adjuntosCliente.includes(a.id)}
                              onChange={() => toggleArchivoCliente(a.id)}
                            />
                            <span>{a.nombre}</span>
                            <small>{(a.tamano / 1024).toFixed(1)} KB</small>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="ayuda-pequena">O sube archivos nuevos (max 10 MB cada uno):</div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      Array.from(e.target.files).forEach(subirArchivoExtra);
                      e.target.value = '';
                    }}
                  />

                  {adjuntosExtras.length > 0 && (
                    <div className="lista-extras">
                      {adjuntosExtras.map((a, idx) => (
                        <div key={idx} className="extra-item">
                          <span>{a.nombre}</span>
                          <small>{(a.tamano / 1024).toFixed(1)} KB</small>
                          <button onClick={() => quitarExtra(idx)} className="btn-peligro">Quitar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="compositor-previa">
                <div className="previa-cabecera">
                  <strong>Vista previa</strong>
                  <button onClick={() => setPrevia(!previa)}>{previa ? 'Editar' : 'Pantalla completa'}</button>
                </div>
                <div className="previa-marco">
                  <div className="previa-asunto">
                    <small>Asunto:</small>
                    <div>{asuntoPrevia || '(vacio)'}</div>
                  </div>
                  <div className="previa-cuerpo" dangerouslySetInnerHTML={{ __html: cuerpoPrevia }}></div>
                </div>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="modal-acciones">
              <button onClick={onCerrar} disabled={enviando}>Cancelar</button>
              <button
                onClick={enviar}
                disabled={enviando || !destinatario || !asunto || !cuerpo}
                className="btn-principal"
              >
                {enviando ? 'Enviando...' : 'Enviar email'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
