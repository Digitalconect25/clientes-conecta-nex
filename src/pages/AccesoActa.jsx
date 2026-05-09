import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verificarAccesoActa, entrarConPIN } from '../lib/api.js';

export default function AccesoActa() {
  const { token } = useParams();
  const [estado, setEstado] = useState('cargando'); // cargando | listo | bloqueado | invalido | dentro
  const [info, setInfo] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [datos, setDatos] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { cargar(); }, [token]);

  async function cargar() {
    try {
      const data = await verificarAccesoActa(token);
      setInfo(data);
      if (data.bloqueado) {
        setEstado('bloqueado');
      } else {
        setEstado('listo');
      }
    } catch (err) {
      setError(err.message);
      setEstado('invalido');
    }
  }

  async function intentar(e) {
    if (e) e.preventDefault();
    if (!pin || pin.length !== 5) {
      setError('El PIN debe tener 5 digitos');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const r = await entrarConPIN(token, pin);
      if (r.ok) {
        setDatos(r);
        setEstado('dentro');
      } else if (r.bloqueado) {
        setError('Has agotado los intentos. Acceso bloqueado durante 1 hora.');
        setEstado('bloqueado');
        setTimeout(cargar, 1000);
      } else {
        setError(`PIN incorrecto. Te quedan ${r.intentos_restantes} intentos.`);
        setPin('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function copiar(texto) {
    navigator.clipboard.writeText(texto || '');
  }

  return (
    <div className="acceso-publico">
      <header className="acceso-header">
        <h1>Conecta Nex</h1>
        <p>Acceso seguro a tu proyecto</p>
      </header>

      <main className="acceso-contenido">
        {estado === 'cargando' && (
          <div className="acceso-cargando">Cargando...</div>
        )}

        {estado === 'invalido' && (
          <div className="acceso-error">
            <h2>Enlace no valido</h2>
            <p>Este enlace no existe o ha sido desactivado.</p>
            <p style={{ fontSize: 12, color: '#666' }}>{error}</p>
          </div>
        )}

        {estado === 'bloqueado' && (
          <div className="acceso-error">
            <h2>Acceso bloqueado</h2>
            <p>Demasiados intentos fallidos. Por seguridad, este enlace se ha bloqueado temporalmente.</p>
            <p>Vuelve a intentarlo en aproximadamente {Math.ceil((info?.segundos_restantes || 3600) / 60)} minutos.</p>
            <p style={{ fontSize: 12, color: '#666', marginTop: 20 }}>
              Si necesitas acceso urgente, contacta con tu agencia.
            </p>
          </div>
        )}

        {estado === 'listo' && (
          <div className="acceso-form-card">
            <h2>Hola {info?.cliente_nombre}</h2>
            <p>Para ver los accesos de tu proyecto, introduce el PIN de 5 digitos que recibiste por email cuando se firmo el acta.</p>

            <form onSubmit={intentar} className="acceso-form">
              <label>PIN de 5 digitos</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength="5"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
                placeholder="00000"
                className="acceso-pin-input"
              />
              {error && <div className="acceso-mensaje-error">{error}</div>}
              <button type="submit" disabled={enviando || pin.length !== 5}>
                {enviando ? 'Verificando...' : 'Entrar'}
              </button>
              <p className="acceso-info">
                Codigo de aceptacion: <strong>{info?.codigo_aceptacion}</strong>
                <br/>
                Intentos disponibles: {info?.max_intentos - info?.intentos_usados} de {info?.max_intentos}
              </p>
            </form>
          </div>
        )}

        {estado === 'dentro' && datos && (
          <div className="acceso-resultado">
            <div className="acceso-bienvenida">
              <h2>Hola {datos.cliente.nombre}</h2>
              <p>Aqui tienes todos los accesos de tu proyecto. Te recomendamos cambiar las contrasenas tras la primera consulta para mantener tu seguridad.</p>
              <p style={{ fontSize: 12, color: '#666' }}>
                Codigo de aceptacion: <strong>{datos.codigo_aceptacion}</strong>
              </p>
            </div>

            {datos.accesos.length === 0 ? (
              <p>No hay accesos guardados para tu proyecto.</p>
            ) : (
              <ListaAccesos accesos={datos.accesos} onCopiar={copiar} />
            )}

            <div className="acceso-aviso-final">
              <strong>Importante:</strong> guarda esta informacion en un lugar seguro.
              Si pierdes este enlace o el PIN, ponte en contacto con Conecta Nex.
            </div>
          </div>
        )}
      </main>

      <footer className="acceso-footer">
        Conecta Nex - Servicios Digital Conect &middot; info.digitalconect@gmail.com
      </footer>
    </div>
  );
}

function ListaAccesos({ accesos, onCopiar }) {
  // Agrupar por categoria
  const grupos = accesos.reduce((acc, a) => {
    const k = a.categoria || 'Otros';
    if (!acc[k]) acc[k] = [];
    acc[k].push(a);
    return acc;
  }, {});

  return (
    <div>
      {Object.keys(grupos).sort().map(cat => (
        <div key={cat} className="acceso-grupo">
          <h3>{cat}</h3>
          {grupos[cat].map(a => <FichaAccesoPublico key={a.id} acceso={a} onCopiar={onCopiar} />)}
        </div>
      ))}
    </div>
  );
}

function FichaAccesoPublico({ acceso, onCopiar }) {
  const [verPwd, setVerPwd] = useState(false);
  return (
    <div className={`acceso-ficha ${acceso.importante ? 'importante' : ''}`}>
      <div className="acceso-ficha-cabecera">
        <strong>{acceso.etiqueta}</strong>
        {acceso.importante && <span className="pill">Importante</span>}
      </div>
      {acceso.url && (
        <div className="acceso-ficha-fila">
          <span className="ca-label">URL</span>
          <a href={acceso.url} target="_blank" rel="noopener noreferrer">{acceso.url}</a>
        </div>
      )}
      {acceso.usuario && (
        <div className="acceso-ficha-fila">
          <span className="ca-label">Usuario</span>
          <span className="ca-valor">{acceso.usuario}</span>
          <button onClick={() => onCopiar(acceso.usuario)}>Copiar</button>
        </div>
      )}
      {acceso.password && (
        <div className="acceso-ficha-fila">
          <span className="ca-label">Contrasena</span>
          <span className="ca-valor mono">{verPwd ? acceso.password : '••••••••'}</span>
          <button onClick={() => setVerPwd(!verPwd)}>{verPwd ? 'Ocultar' : 'Mostrar'}</button>
          <button onClick={() => onCopiar(acceso.password)}>Copiar</button>
        </div>
      )}
      {acceso.notas && <div className="acceso-ficha-notas">{acceso.notas}</div>}
    </div>
  );
}
