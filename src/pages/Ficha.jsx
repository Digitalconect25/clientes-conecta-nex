import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import FirmaCanvas from '../components/FirmaCanvas.jsx';
import { seccionesActivas, camposFaltantes } from '../lib/fichas.js';

const C = { ink: '#20242a', cuerpo: '#3a3f46', tenue: '#707a83', teal: '#0c7b6d', crema: '#f7f5ef', linea: '#ece7da', fondo: '#f1efe8' };

function urlApi(token, extra) {
  return '/api/ficha?token=' + encodeURIComponent(token) + (extra || '');
}

export default function Ficha() {
  const { token } = useParams();
  const [ficha, setFicha] = useState(null);
  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [error, setError] = useState('');
  const [contenido, setContenido] = useState({});
  const [guardadoEn, setGuardadoEn] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [faltan, setFaltan] = useState([]);
  const [pasoFirma, setPasoFirma] = useState(false);

  // Firma
  const [nombre, setNombre] = useState('');
  const [nif, setNif] = useState('');
  const [cargo, setCargo] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [cifNifCliente, setCifNifCliente] = useState('');
  const [lugar, setLugar] = useState('');
  const [funciones, setFunciones] = useState('');
  const [pendientes, setPendientes] = useState('');
  const [decl, setDecl] = useState({ capacidad_representacion: false, aprueba_alcance: false, autoriza_tratamiento_operativo: false, recibe_copia: false });
  const [firmaImg, setFirmaImg] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [emailMask, setEmailMask] = useState('');
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorFirma, setErrorFirma] = useState('');

  const timerAutoguardado = useRef(null);
  // El guardado sale con retardo, asi que no puede leer `contenido` del cierre:
  // leeria el valor ANTERIOR al ultimo cambio y guardaria siempre una edicion
  // atrasada (el cliente veia "Borrador guardado" y perdia lo ultimo que escribio).
  const contenidoRef = useRef({});
  const secciones = useMemo(() => (ficha ? seccionesActivas(ficha.secciones) : []), [ficha]);

  useEffect(() => {
    fetch(urlApi(token))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) { setError(j.error || 'No disponible'); setEstadoCarga('error'); return; }
        setFicha(j);
        setContenido(j.contenido || {});
        contenidoRef.current = j.contenido || {};
        setPasoFirma(j.estado === 'completada');
        setEstadoCarga('ok');
      })
      .catch(() => { setError('No se pudo cargar.'); setEstadoCarga('error'); });
  }, [token]);

  // Si el cliente cierra la pestana antes de que salte el guardado, el temporizador
  // se queda colgado apuntando a un componente que ya no existe.
  useEffect(() => () => { if (timerAutoguardado.current) clearTimeout(timerAutoguardado.current); }, []);

  function actualizarCampo(seccionClave, campoClave, valor) {
    setContenido((prev) => {
      const siguiente = { ...prev, [seccionClave]: { ...(prev[seccionClave] || {}), [campoClave]: valor } };
      contenidoRef.current = siguiente;
      return siguiente;
    });
    if (timerAutoguardado.current) clearTimeout(timerAutoguardado.current);
    timerAutoguardado.current = setTimeout(() => guardarBorrador(true), 2500);
  }

  function toggleCheckbox(seccionClave, campoClave, opcion) {
    setContenido((prev) => {
      const actuales = Array.isArray(prev[seccionClave]?.[campoClave]) ? prev[seccionClave][campoClave] : [];
      const nuevas = actuales.includes(opcion) ? actuales.filter((o) => o !== opcion) : [...actuales, opcion];
      const siguiente = { ...prev, [seccionClave]: { ...(prev[seccionClave] || {}), [campoClave]: nuevas } };
      contenidoRef.current = siguiente;
      return siguiente;
    });
    if (timerAutoguardado.current) clearTimeout(timerAutoguardado.current);
    timerAutoguardado.current = setTimeout(() => guardarBorrador(true), 1200);
  }

  async function guardarBorrador(silencioso) {
    if (!silencioso) setGuardando(true);
    try {
      const r = await fetch(urlApi(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar', contenido: contenidoRef.current }) });
      // Callar el fallo era peor que el fallo: el cliente seguia viendo la hora
      // del ultimo guardado que si funciono y se marchaba creyendo que estaba todo.
      if (r.ok) { setGuardadoEn(new Date()); setErrorGuardado(''); }
      else setErrorGuardado('No se ha podido guardar el ultimo cambio. Vuelve a intentarlo antes de cerrar.');
    } catch { setErrorGuardado('Sin conexion: el ultimo cambio no se ha guardado todavia. No cierres esta pagina.'); }
    finally { if (!silencioso) setGuardando(false); }
  }

  async function continuarAFirma() {
    setEnviando(true); setFaltan([]);
    try {
      await guardarBorrador(true);
      const r = await fetch(urlApi(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar', contenido: contenidoRef.current }) });
      const j = await r.json();
      if (r.ok && j.ok) { setPasoFirma(true); setTimeout(() => document.getElementById('bloque-firma')?.scrollIntoView({ behavior: 'smooth' }), 60); }
      else setFaltan(j.faltan || [j.error || 'No se pudo continuar.']);
    } catch { setFaltan(['No se pudo conectar. Inténtalo de nuevo.']); }
    finally { setEnviando(false); }
  }

  async function pedirCodigo() {
    // A donde va el codigo lo decide el servidor: al email de contacto que
    // registro la agencia. Si lo eligiera quien abre el enlace, podria mandarselo
    // a si mismo y firmar en nombre del cliente.
    setErrorFirma(''); setEnviandoCodigo(true);
    try {
      const r = await fetch(urlApi(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar_codigo' }) });
      const j = await r.json();
      if (r.ok && j.ok) { setCodigoEnviado(true); setEmailMask(j.email || ''); } else setErrorFirma(j.error || 'No se pudo enviar el código.');
    } catch { setErrorFirma('No se pudo conectar.'); }
    finally { setEnviandoCodigo(false); }
  }

  async function hacerPDF(html) {
    if (!html) return;
    setGenerandoPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      el.style.width = '794px'; el.innerHTML = html;
      const opt = { margin: [10, 8, 10, 8], html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
      const blob = await html2pdf().set(opt).from(el).output('blob');
      setPdfUrl(URL.createObjectURL(blob));
      const b64 = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
      fetch(urlApi(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar_pdf', pdf_base64: b64 }) }).catch(() => {});
    } catch { /* el email lleva la ficha como respaldo */ }
    finally { setGenerandoPdf(false); }
  }

  async function firmar() {
    if (!firmaImg) { setErrorFirma('Dibuja tu firma en el recuadro (con el dedo o el ratón).'); return; }
    if (nombre.trim().length < 3) { setErrorFirma('Escribe el nombre y apellidos del representante.'); return; }
    if (!nif.trim()) { setErrorFirma('Falta el DNI o NIE del representante.'); return; }
    if (!Object.values(decl).every(Boolean)) { setErrorFirma('Marca las cuatro declaraciones del firmante.'); return; }
    if (codigo.trim().length < 4) { setErrorFirma('Introduce el código que te hemos enviado por email.'); return; }
    setErrorFirma(''); setFirmando(true);
    try {
      const r = await fetch(urlApi(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'firmar', firmante_nombre: nombre.trim(), firmante_nif: nif.trim(), firmante_cargo: cargo.trim(),
          razon_social_cliente: razonSocial.trim(), cif_nif_cliente: cifNifCliente.trim(), lugar: lugar.trim(),
          funciones_aprobadas: funciones.trim(), pendientes_exclusiones: pendientes.trim(),
          declaraciones: decl, codigo: codigo.trim(), firma_img: firmaImg,
        }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setHecho(true); hacerPDF(j.signed_html); } else setErrorFirma(j.error || 'No se pudo firmar.');
    } catch { setErrorFirma('No se pudo conectar.'); }
    finally { setFirmando(false); }
  }

  const wrap = { maxWidth: 820, margin: '30px auto', padding: '0 16px 60px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: C.ink };
  const card = { background: '#fff', border: '1px solid ' + C.linea, borderRadius: 16, boxShadow: '0 6px 24px rgba(16,40,28,.06)', marginBottom: 18 };
  const fieldSt = { width: '100%', padding: '11px 13px', borderRadius: 9, border: '1px solid #d7ddd9', fontSize: 14.5, boxSizing: 'border-box', fontFamily: 'inherit' };
  const labSt = { display: 'block', fontSize: 13, fontWeight: 700, margin: '12px 0 4px', color: C.cuerpo };
  const ayudaSt = { fontSize: 12, color: C.tenue, margin: '0 0 4px' };

  if (estadoCarga === 'cargando') return <div style={{ ...wrap, textAlign: 'center', color: C.tenue, marginTop: 80 }}>Cargando ficha…</div>;
  if (estadoCarga === 'error') return (
    <div style={wrap}><div style={{ ...card, padding: 30, textAlign: 'center' }}>
      <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 6px' }}>Ficha no disponible</h2>
      <p style={{ color: C.tenue }}>{error}</p>
    </div></div>
  );

  const yaFirmada = hecho || ficha.firmado;

  return (
    <div style={{ background: C.fondo, minHeight: '100vh' }}>
      <div style={wrap}>
        <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
          <img src="/logo-email.png" alt="Conecta NEX" style={{ maxWidth: 150, height: 'auto' }} />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>{ficha.titulo}</h1>
          <p style={{ color: C.tenue, margin: 0 }}>{ficha.cliente_nombre ? <>Para: <b>{ficha.cliente_nombre}</b> · </> : null}Versión {ficha.version}</p>
        </div>

        {yaFirmada ? (
          <div style={{ ...card, padding: 26, textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Ficha firmada</div>
            <p style={{ color: C.cuerpo, margin: '6px 0 0' }}>Gracias{ficha.firmante_nombre ? ', ' + ficha.firmante_nombre : ''}. Tu firma ha quedado registrada con fecha, hora, IP y un número de validación{ficha.firma_ref ? ` (${ficha.firma_ref})` : ''}. Te enviamos una copia por email.</p>
            {generandoPdf && <p style={{ color: C.tenue, fontSize: 13, marginTop: 12 }}>Preparando tu PDF…</p>}
            {pdfUrl && <a href={pdfUrl} download="ficha-implementacion-firmada.pdf" style={{ display: 'inline-block', marginTop: 14, background: C.teal, color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 22px', borderRadius: 10 }}>⬇ Descargar la ficha (PDF)</a>}
          </div>
        ) : (
          <>
            {secciones.map((seccion) => (
              <div key={seccion.clave} id={'seccion-' + seccion.clave} style={{ ...card, padding: '20px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: '.04em' }}>{seccion.numero}</div>
                <h2 style={{ margin: '2px 0 2px', fontSize: 19 }}>{seccion.titulo}</h2>
                <p style={{ color: C.tenue, fontSize: 13, margin: '0 0 6px' }}>{seccion.subtitulo}</p>
                {seccion.nota && <div style={{ background: C.crema, border: '1px solid ' + C.linea, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: C.cuerpo, margin: '6px 0 10px' }}>{seccion.nota}</div>}
                {seccion.campos.map((campo) => {
                  const valor = contenido[seccion.clave]?.[campo.clave];
                  return (
                    <div key={campo.clave}>
                      <label style={labSt}>{campo.etiqueta}{campo.requerido ? ' *' : ''}</label>
                      {campo.ayuda && <p style={ayudaSt}>{campo.ayuda}</p>}
                      {campo.tipo === 'checkbox_grupo' ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '4px 0 2px' }}>
                          {campo.opciones.map((op) => (
                            <label key={op} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, color: C.cuerpo, cursor: 'pointer' }}>
                              <input type="checkbox" checked={Array.isArray(valor) && valor.includes(op)} onChange={() => toggleCheckbox(seccion.clave, campo.clave, op)} />
                              {op}
                            </label>
                          ))}
                        </div>
                      ) : campo.tipo === 'textarea' ? (
                        <textarea rows={3} value={valor || ''} onChange={(e) => actualizarCampo(seccion.clave, campo.clave, e.target.value)} style={{ ...fieldSt, resize: 'vertical' }} />
                      ) : (
                        <input value={valor || ''} onChange={(e) => actualizarCampo(seccion.clave, campo.clave, e.target.value)} style={fieldSt} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', margin: '4px 0 22px' }}>
              <span style={{ fontSize: 12.5, color: errorGuardado ? '#b42318' : C.tenue, fontWeight: errorGuardado ? 700 : 400 }}>
                {errorGuardado ? errorGuardado
                  : guardando ? 'Guardando…'
                  : guardadoEn ? `Borrador guardado ${guardadoEn.toLocaleTimeString('es-ES')}`
                  : 'Se guarda solo mientras escribes.'}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => guardarBorrador(false)} disabled={guardando}
                  style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid ' + C.teal, background: '#fff', color: C.teal, fontWeight: 700, cursor: 'pointer' }}>
                  Guardar borrador
                </button>
                <button onClick={continuarAFirma} disabled={enviando}
                  style={{ padding: '11px 22px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: enviando ? .6 : 1 }}>
                  {enviando ? 'Comprobando…' : 'Continuar a la firma →'}
                </button>
              </div>
            </div>
            {faltan.length > 0 && (
              <div style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', color: '#92400e', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13.5 }}>
                <b>Falta completar:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{faltan.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}

            {pasoFirma && (
              <div id="bloque-firma" style={{ ...card, padding: '22px 24px', border: '1px solid ' + C.teal }}>
                <h2 style={{ margin: '0 0 2px', fontSize: 19 }}>14 · Firma</h2>
                <p style={{ color: C.tenue, fontSize: 13, margin: '0 0 10px' }}>Aprobación y constancia: cierre de la ficha de implementación.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labSt}>Razón social del cliente</label><input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} style={fieldSt} /></div>
                  <div><label style={labSt}>CIF o NIF</label><input value={cifNifCliente} onChange={(e) => setCifNifCliente(e.target.value)} style={fieldSt} /></div>
                  <div><label style={labSt}>Representante *</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={fieldSt} /></div>
                  <div><label style={labSt}>DNI o NIE *</label><input value={nif} onChange={(e) => setNif(e.target.value)} style={fieldSt} /></div>
                  <div><label style={labSt}>Cargo</label><input value={cargo} onChange={(e) => setCargo(e.target.value)} style={fieldSt} /></div>
                  <div><label style={labSt}>Lugar</label><input value={lugar} onChange={(e) => setLugar(e.target.value)} style={fieldSt} /></div>
                </div>
                <label style={labSt}>Funciones aprobadas para la primera versión</label>
                <textarea rows={2} value={funciones} onChange={(e) => setFunciones(e.target.value)} style={{ ...fieldSt, resize: 'vertical' }} />
                <label style={labSt}>Pendientes, exclusiones y condiciones de aprobación</label>
                <textarea rows={2} value={pendientes} onChange={(e) => setPendientes(e.target.value)} style={{ ...fieldSt, resize: 'vertical' }} />

                <div style={{ margin: '14px 0 4px', fontWeight: 700, fontSize: 14 }}>El firmante declara</div>
                {[
                  ['capacidad_representacion', 'Tiene capacidad de representación'],
                  ['aprueba_alcance', 'Aprueba el alcance'],
                  ['autoriza_tratamiento_operativo', 'Autoriza el tratamiento operativo'],
                  ['recibe_copia', 'Recibe copia de la ficha'],
                ].map(([clave, texto]) => (
                  <label key={clave} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '6px 0', fontSize: 14, color: C.cuerpo, cursor: 'pointer' }}>
                    <input type="checkbox" checked={decl[clave]} onChange={(e) => setDecl((d) => ({ ...d, [clave]: e.target.checked }))} style={{ marginTop: 2 }} />
                    <span>{texto}</span>
                  </label>
                ))}

                <label style={labSt}>Tu firma (dibújala con el dedo o el ratón)</label>
                <div style={{ background: '#fff', border: '1px solid #d7ddd9', borderRadius: 10, padding: 6 }}>
                  <FirmaCanvas onChange={setFirmaImg} />
                </div>

                <label style={labSt}>Código de firma</label>
                {!codigoEnviado ? (
                  <>
                    <p style={{ fontSize: 13, color: C.tenue, margin: '0 0 8px' }}>
                      Te enviaremos un código de un solo uso al email de contacto que la agencia tiene registrado para esta ficha.
                    </p>
                    <button onClick={pedirCodigo} disabled={enviandoCodigo}
                      style={{ width: '100%', marginTop: 8, padding: '12px', borderRadius: 10, border: '1px solid ' + C.teal, background: '#fff', color: C.teal, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
                      {enviandoCodigo ? 'Enviando…' : '📧 Enviar código a mi email'}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: C.tenue, margin: '0 0 6px' }}>Te enviamos un código a <b>{emailMask}</b>. Introdúcelo aquí:</p>
                    <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos"
                      style={{ ...fieldSt, letterSpacing: 6, fontWeight: 700, textAlign: 'center' }} />
                    <button onClick={pedirCodigo} disabled={enviandoCodigo} style={{ background: 'none', border: 0, color: C.teal, fontSize: 12.5, cursor: 'pointer', marginTop: 6, padding: 0 }}>Reenviar código</button>
                  </>
                )}

                {errorFirma && <p style={{ color: '#c0392b', fontSize: 13, margin: '10px 0 0' }}>{errorFirma}</p>}
                <button onClick={firmar} disabled={firmando}
                  style={{ marginTop: 14, width: '100%', padding: '15px', borderRadius: 10, border: 0, background: C.teal, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: firmando ? 0.6 : 1 }}>
                  {firmando ? 'Registrando firma…' : '✔ Firmar ficha'}
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ padding: '18px 0', color: '#9a9384', fontSize: 12, textAlign: 'center' }}>
          Conecta NEX · Calle Alberola 24, 03007 Alicante · <a href="https://conectanex.es" target="_blank" rel="noopener noreferrer" style={{ color: C.teal, textDecoration: 'none' }}>conectanex.es</a>
        </div>
      </div>
    </div>
  );
}
