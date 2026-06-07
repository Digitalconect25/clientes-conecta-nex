import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getPassword, clearPassword } from './lib/api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Emisor from './pages/Emisor.jsx';
import Proyectos from './pages/Proyectos.jsx';
import Emails from './pages/Emails.jsx';
import Prospeccion from './pages/Prospeccion.jsx';
import Agenda from './pages/Agenda.jsx';
import Agendar from './pages/Agendar.jsx';
import Solicitud from './pages/Solicitud.jsx';
import AccesoActa from './pages/AccesoActa.jsx';
import GeneradorQR from './pages/GeneradorQR.jsx';

export default function App() {
  const [auth, setAuth] = useState(!!getPassword());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onStorage = () => setAuth(!!getPassword());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function handleLogout() {
    clearPassword();
    setAuth(false);
    navigate('/login');
  }

  // La ruta /acceso/:token es PUBLICA. Cualquier persona con el enlace
  // puede entrar (luego se le pedira el PIN). NO requiere login de admin.
  const esRutaPublica = location.pathname.startsWith('/acceso/') || location.pathname.startsWith('/agendar') || location.pathname.startsWith('/solicitud');
  if (esRutaPublica) {
    return (
      <Routes>
        <Route path="/acceso/:token" element={<AccesoActa />} />
        <Route path="/agendar" element={<Agendar />} />
        <Route path="/solicitud" element={<Solicitud />} />
      </Routes>
    );
  }

  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={() => setAuth(true)} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/prospeccion" element={<Prospeccion />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/qr" element={<GeneradorQR />} />
        <Route path="/emisor" element={<Emisor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
