import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtEuros } from '../lib/contratos.js';

// Fases del circuito de contratación, en orden del embudo.
const FASES = [
  { key: 'datos_pendientes', label: 'Datos fiscales pendientes', desc: 'Esperando que el cliente rellene sus datos.', color: '#92400e', bg: '#fffbeb', borde: '#f59e0b' },
  { key: 'contrato_pendiente', label: 'Listo para enviar contrato', desc: 'Datos completos. Falta enviar o firmar el contrato.', color: '#1e40af', bg: '#eff6ff', borde: '#3b82f6' },
  { key: 'firma_pendiente', label: 'Esperando firma del cliente', desc: 'Contrato enviado. El cliente aún no ha firmado.', color: '#92400e', bg: '#fffbeb', borde: '#f59e0b' },
  { key: 'validacion_pendiente', label: 'Pendiente de TU validación', desc: 'El cliente ya firmó. Valida con el código que recibiste por email para arrancar el encargo.', color: '#b45309', bg: '#fff7ed', borde: '#ea580c' },
  { key: 'en_curso', label: 'Validado · encargo en curso', desc: 'Firmado y validado por ambas partes. Trabajo en marcha.', color: '#166534', bg: '#f0fdf4', borde: '#047857' },
  { key: 'entregado', label: 'Entregado', desc: 'Encargo finalizado.', color: '#0c7b6d', bg: '#ecfdf5', borde: '#0c7b6d' },
  { key: 'rechazado', label: 'Rechazado', desc: 'El cliente rechazó el contrato.', color: '#991b1b', bg: '#fef2f2', borde: '#dc2626' },
  { key: 'cancelado', label: 'Cancelado', desc: '', color: '#6b7280', bg: '#f9fafb', borde: '#9ca3af' },
];
const MAPA_FASE = Object.fromEntries(FASES.map((f) => [f.key, f]));

export default function Embudo() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true); setError('');
    try {
      const r = await api.embudoList();
      setClientes(r.clientes || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el embudo.');
    } finally {
      setCargando(false);
    }
  }

  if (cargando) return <div className="empty">Cargando embudo...</div>;

  const porFase = {};
  for (const f of FASES) porFase[f.key] = [];
  for (const c of clientes) (porFase[c.fase] || (porFase[c.fase] = [])).push(c);

  const totalContractables = clientes.length;

  return (
    <div>
      <div className="main-header">
        <h1>Embudo de contratación</h1>
        <button className="btn-outline" onClick={cargar}>Actualizar</button>
      </div>

      {error && <div className="card" style={{ borderLeft: '4px solid #dc2626', color: '#991b1b' }}>{error}</div>}

      {/* Resumen: una pastilla por fase con su recuento */}
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {FASES.map((f) => {
          const n = (porFase[f.key] || []).length;
          return (
            <div key={f.key} title={f.desc}
              style={{ flex: '1 1 140px', minWidth: 140, background: f.bg, borderLeft: `4px solid ${f.borde}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: f.color, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 11.5, color: f.color, marginTop: 4, fontWeight: 600 }}>{f.label}</div>
            </div>
          );
        })}
      </div>

      {totalContractables === 0 && (
        <div className="empty"><p>Aún no hay clientes en el embudo. Cuando una propuesta se acepte, el cliente aparecerá aquí.</p></div>
      )}

      {/* Una sección por fase (solo las que tienen clientes) */}
      {FASES.map((f) => {
        const filas = porFase[f.key] || [];
        if (filas.length === 0) return null;
        const accionable = f.key === 'validacion_pendiente';
        return (
          <div key={f.key} className="card" style={{ borderLeft: `4px solid ${f.borde}`, ...(accionable ? { boxShadow: '0 0 0 2px #ffedd5' } : {}) }}>
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, color: f.color }}>
                {f.label} <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>({filas.length})</span>
              </h2>
              {f.desc && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{f.desc}</p>}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <FilaCliente key={c.id} c={c} fase={f} navigate={navigate} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function FilaCliente({ c, fase, navigate }) {
  const doc = c.doc;
  const irAFicha = () => navigate(`/clientes/${c.id}`);

  return (
    <tr style={{ cursor: 'pointer', background: fase.bg }} onClick={irAFicha}>
      <td>
        <strong>{c.nombre}</strong>
        <div style={{ color: '#6b7280', fontSize: 11 }}>
          {c.numero_cliente}{c.email ? ' · ' + c.email : ''}
        </div>
      </td>
      <td style={{ fontSize: 12 }}>
        {doc ? (
          <>
            <span style={{ fontWeight: 600 }}>{doc.nombre}</span>
            {doc.firmante_nombre && <div style={{ color: '#6b7280', fontSize: 11 }}>Firmado por {doc.firmante_nombre}</div>}
            {doc.firma_ref && <div style={{ color: '#6b7280', fontSize: 11 }}>Nº {doc.firma_ref}</div>}
          </>
        ) : (
          <span style={{ color: '#9ca3af' }}>
            {c.datos_estado === 'enviado' ? 'Formulario de datos enviado' : c.datos_estado === 'completado' ? 'Datos completos' : 'Sin contrato'}
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtEuros(c.total)}</td>
      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
        <Accion c={c} fase={fase} doc={doc} navigate={navigate} />
      </td>
    </tr>
  );
}

function Accion({ c, fase, doc, navigate }) {
  if (fase.key === 'validacion_pendiente') {
    if (doc?.validacion_token) {
      return (
        <a href={`/validar/${doc.validacion_token}`} target="_blank" rel="noreferrer"
          className="btn-primary" style={{ textDecoration: 'none', fontSize: 13, padding: '7px 14px', whiteSpace: 'nowrap' }}>
          Validar ahora
        </a>
      );
    }
    return <span style={{ fontSize: 12, color: '#9ca3af' }}>Sin enlace de validación</span>;
  }
  if (fase.key === 'firma_pendiente' && doc?.firma_token) {
    return (
      <a href={`/firmar/${doc.firma_token}`} target="_blank" rel="noreferrer"
        className="btn-outline" style={{ textDecoration: 'none', fontSize: 12.5, padding: '6px 12px', whiteSpace: 'nowrap' }}>
        Ver enlace de firma
      </a>
    );
  }
  return (
    <button className="btn-outline" style={{ fontSize: 12.5, padding: '6px 12px' }}
      onClick={() => navigate(`/clientes/${c.id}`)}>
      Abrir ficha
    </button>
  );
}
