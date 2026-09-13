import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { getPassword, clearPassword } from './lib/api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

// Cada pagina se descarga al entrar en ella, no al abrir la aplicacion. Antes
// iban las 24 en el mismo paquete, asi que el cliente que solo abre su enlace
// para firmar desde el movil se descargaba ademas el panel entero de la agencia
// (dashboard, bandeja, emails, generador de QR) sin llegar a verlo nunca.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Clientes = lazy(() => import('./pages/Clientes.jsx'));
const ClienteDetalle = lazy(() => import('./pages/ClienteDetalle.jsx'));
const Embudo = lazy(() => import('./pages/Embudo.jsx'));
const Catalogo = lazy(() => import('./pages/Catalogo.jsx'));
const Emisor = lazy(() => import('./pages/Emisor.jsx'));
const Proyectos = lazy(() => import('./pages/Proyectos.jsx'));
const Emails = lazy(() => import('./pages/Emails.jsx'));
const Prospeccion = lazy(() => import('./pages/Prospeccion.jsx'));
const Agenda = lazy(() => import('./pages/Agenda.jsx'));
const Bandeja = lazy(() => import('./pages/Bandeja.jsx'));
const Agendar = lazy(() => import('./pages/Agendar.jsx'));
const Solicitud = lazy(() => import('./pages/Solicitud.jsx'));
const Propuesta = lazy(() => import('./pages/Propuesta.jsx'));
const Firmar = lazy(() => import('./pages/Firmar.jsx'));
const ValidarAgencia = lazy(() => import('./pages/ValidarAgencia.jsx'));
const FirmaEmpresa = lazy(() => import('./pages/FirmaEmpresa.jsx'));
const DatosFiscales = lazy(() => import('./pages/DatosFiscales.jsx'));
const AccesoActa = lazy(() => import('./pages/AccesoActa.jsx'));
const GeneradorQR = lazy(() => import('./pages/GeneradorQR.jsx'));
const Diseno = lazy(() => import('./pages/Diseno.jsx'));
const Fichas = lazy(() => import('./pages/Fichas.jsx'));
const Ficha = lazy(() => import('./pages/Ficha.jsx'));
const ValidarFicha = lazy(() => import('./pages/ValidarFicha.jsx'));

function Cargando() {
  return <div style={{ padding: 48, textAlign: 'center', color: '#667085', fontSize: 14 }}>Cargando…</div>;
}

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
  const esRutaPublica = location.pathname.startsWith('/acceso/') || location.pathname.startsWith('/agendar') || location.pathname.startsWith('/solicitud') || location.pathname.startsWith('/propuesta/') || location.pathname.startsWith('/firmar/') || location.pathname.startsWith('/validar/') || location.pathname.startsWith('/firma-empresa/') || location.pathname.startsWith('/datos-fiscales/') || location.pathname.startsWith('/ficha/') || location.pathname.startsWith('/validar-ficha/');
  if (esRutaPublica) {
    return (
      <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/acceso/:token" element={<AccesoActa />} />
          <Route path="/agendar" element={<Agendar />} />
          <Route path="/solicitud" element={<Solicitud />} />
          <Route path="/propuesta/:token" element={<Propuesta />} />
          <Route path="/firmar/:token" element={<Firmar />} />
          <Route path="/validar/:token" element={<ValidarAgencia />} />
          <Route path="/firma-empresa/:token" element={<FirmaEmpresa />} />
          <Route path="/datos-fiscales/:token" element={<DatosFiscales />} />
          <Route path="/ficha/:token" element={<Ficha />} />
          <Route path="/validar-ficha/:token" element={<ValidarFicha />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
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
      <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />
        <Route path="/embudo" element={<Embudo />} />
        <Route path="/fichas" element={<Fichas />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/prospeccion" element={<Prospeccion />} />
        {/* Sin id entra por el menu y elige cliente ahi mismo; con id, va directo. */}
        <Route path="/diseno" element={<Diseno />} />
        <Route path="/diseno/:prospectoId" element={<Diseno />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/bandeja" element={<Bandeja />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/qr" element={<GeneradorQR />} />
        <Route path="/emisor" element={<Emisor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
