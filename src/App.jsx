import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getPassword, clearPassword } from './lib/api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Emisor from './pages/Emisor.jsx';

export default function App() {
  const [auth, setAuth] = useState(!!getPassword());
  const navigate = useNavigate();

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
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/emisor" element={<Emisor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
