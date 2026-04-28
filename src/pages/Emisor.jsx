import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Emisor() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api.emisorGet().then(setDatos).catch(console.error).finally(() => setCargando(false));
  }, []);

  function set(k, v) { setDatos((d) => ({ ...d, [k]: v })); }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const actualizado = await api.emisorUpdate(datos);
      setDatos(actualizado);
      setMensaje({ tipo: 'ok', texto: 'Datos guardados correctamente' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally { setGuardando(false); }
  }

  if (cargando || !datos) return <div className="empty">Cargando...</div>;

  return (
    <div>
      <div className="main-header"><h1>Mis datos como emisor</h1></div>

      {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div className="card">
        <p style={{ fontSize: 13, color: 'var(--gris-5)', marginBottom: 20 }}>
          Estos datos aparecen en TODOS los contratos generados. Rellenalos una vez y se aplican automaticamente.
        </p>
        <div className="grid">
          <div><label>Nombre completo *</label><input value={datos.nombre || ''} onChange={(e) => set('nombre', e.target.value)} /></div>
          <div><label>NIF / NIE *</label><input value={datos.nif || ''} onChange={(e) => set('nif', e.target.value.toUpperCase())} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>Nombre comercial</label><input value={datos.nombre_comercial || ''} onChange={(e) => set('nombre_comercial', e.target.value)} /></div>
          <div><label>Epigrafe IAE</label><input value={datos.epigrafe || ''} onChange={(e) => set('epigrafe', e.target.value)} placeholder="Ej: 763.1" /></div>
          <div><label>Telefono</label><input value={datos.telefono || ''} onChange={(e) => set('telefono', e.target.value)} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>Direccion</label><input value={datos.direccion || ''} onChange={(e) => set('direccion', e.target.value)} /></div>
          <div><label>CP</label><input value={datos.cp || ''} onChange={(e) => set('cp', e.target.value)} /></div>
          <div><label>Ciudad</label><input value={datos.ciudad || ''} onChange={(e) => set('ciudad', e.target.value)} /></div>
          <div><label>Provincia</label><input value={datos.provincia || ''} onChange={(e) => set('provincia', e.target.value)} /></div>
          <div><label>Email</label><input type="email" value={datos.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div><label>Web</label><input value={datos.web || ''} onChange={(e) => set('web', e.target.value)} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>IBAN para transferencias</label><input value={datos.iban || ''} onChange={(e) => set('iban', e.target.value.toUpperCase())} placeholder="ES00 0000 0000 0000 0000 0000" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 15, borderTop: '1px solid var(--gris-3)' }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar mis datos'}</button>
        </div>
      </div>
    </div>
  );
}
