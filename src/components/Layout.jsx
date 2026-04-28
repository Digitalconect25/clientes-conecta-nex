import { NavLink } from 'react-router-dom';

export default function Layout({ children, onLogout }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Conecta Nex</h2>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/catalogo">Catalogo</NavLink>
          <NavLink to="/emisor">Mis datos</NavLink>
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
