import { NavLink } from 'react-router-dom';

// El cotizador vive en Cloudflare Workers (los leads de la web entran ahi).
const COTIZADOR_URL = 'https://cotizador-conecta-nex.info-digitalconect.workers.dev';

export default function Layout({ children, onLogout }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-marca">
          <img src="/logo-conecta-nex.png" alt="Conecta Nex" className="sidebar-logo" />
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/proyectos">Proyectos</NavLink>
          <NavLink to="/emails">Emails</NavLink>
          <NavLink to="/prospeccion">Captacion en frio</NavLink>
          <NavLink to="/bandeja">Bandeja</NavLink>
          <NavLink to="/agenda">Agenda</NavLink>
          <NavLink to="/catalogo">Catalogo</NavLink>
          <NavLink to="/qr">Generador QR</NavLink>
          <NavLink to="/emisor">Mis datos</NavLink>
          <div style={{ margin: '10px 20px 4px', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Cotizador (web)</div>
          <a href={`${COTIZADOR_URL}/dashboard`} target="_blank" rel="noreferrer">Cotizador ↗</a>
          <a href={`${COTIZADOR_URL}/dashboard#leads`} target="_blank" rel="noreferrer">Leads (web) ↗</a>
        </nav>
        <div style={{ padding: '15px 20px', marginTop: 30, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <button
            onClick={onLogout}
            style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', width: '100%', justifyContent: 'center' }}
          >
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
