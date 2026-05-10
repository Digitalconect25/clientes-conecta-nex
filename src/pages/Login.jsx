import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [password, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api.login(password);
      onLogin();
      navigate('/');
    } catch (err) {
      setError('Password incorrecta');
      setCargando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo-conecta-nex.png" alt="Conecta Nex" className="login-logo" />
        <p className="subtitle">Sistema de gestion de clientes</p>
        <form onSubmit={handleSubmit}>
          <label>Contrasena</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordInput(e.target.value)}
            autoFocus
            required
          />
          {error && <div className="alerta alerta-error" style={{ marginTop: 10 }}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={cargando || !password}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
