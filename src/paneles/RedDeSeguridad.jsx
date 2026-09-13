// Red de seguridad · portada de ~/smart-offer-lab/src/RedDeSeguridad.tsx
//
// Sin esto, un error en cualquier panel desmonta el arbol entero y deja la
// pantalla en blanco: ni un boton que pulsar, ni forma de recuperar lo escrito.
//
// Cambia una cosa respecto a la version local: alli el boton de rescate leia
// localStorage a pelo, porque los datos vivian en el navegador. Aqui viven en
// Neon, asi que la copia se hace con lo que la pagina tiene en memoria en ese
// momento (que es justo lo que aun no se ha guardado y por tanto lo unico que
// se puede perder). Se pasa por `datos()` en vez de por el estado de React: si
// la aplicacion se ha roto, lo ultimo de lo que hay que fiarse es de ella.
import { Component } from 'react';

export class RedDeSeguridad extends Component {
  state = { error: null, copiaDescargada: false, mensaje: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en la consola para poder diagnosticarlo despues.
    console.error('[Offer Lab] fallo en', this.props.ambito ?? 'la aplicacion', error, info);
  }

  descargarCopia = () => {
    try {
      const crudo = JSON.stringify(this.props.datos?.() ?? null, null, 2);
      if (!crudo || crudo === 'null') {
        this.setState({ mensaje: 'No hay nada en memoria que copiar.' });
        return;
      }
      const blob = new Blob([crudo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offer-lab-rescate-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.setState({ copiaDescargada: true, mensaje: null });
    } catch {
      this.setState({ mensaje: 'Este navegador no deja generar la copia.' });
    }
  };

  render() {
    const { error, copiaDescargada, mensaje } = this.state;
    if (!error) return this.props.children;

    const donde = this.props.ambito ? `en «${this.props.ambito}»` : 'en la herramienta';

    return (
      <section className="b2 dura bg-papel">
        <h2 className="bg-amarillo t-titulo negra mayus" style={{ margin: 0, borderBottom: '2px solid #000', padding: '12px 16px', lineHeight: 1, letterSpacing: '-0.03em' }}>
          Algo ha fallado {donde}
        </h2>

        <div style={{ padding: 16 }}>
          <p className="t-cuerpo" style={{ maxWidth: '65ch', fontWeight: 500 }}>
            Lo que ya estaba guardado sigue en la ficha del prospecto. Lo que haya escrito desde
            el ultimo «Guardar» solo esta aqui: descarguelo antes de recargar.
          </p>

          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={this.descargarCopia} className="b2 dura-sm pulsable bg-amarillo t-micro negra mayus" style={{ minHeight: 44, padding: '0 16px', letterSpacing: '0.08em' }}>
              ↓ Guardar copia de lo no guardado
            </button>
            <button onClick={() => this.setState({ error: null })} className="b2 dura-sm pulsable bg-papel t-micro negra mayus" style={{ minHeight: 44, padding: '0 16px', letterSpacing: '0.08em' }}>
              Volver a intentarlo
            </button>
            <button onClick={() => location.reload()} className="b2 dura-sm pulsable bg-papel t-micro negra mayus" style={{ minHeight: 44, padding: '0 16px', letterSpacing: '0.08em' }}>
              Recargar la pagina
            </button>
          </div>

          {copiaDescargada && (
            <p className="b2 bg-amarillo t-dato negra" style={{ marginTop: 12, display: 'inline-block', padding: '6px 12px' }}>
              Copia descargada. Ya puede recargar sin miedo.
            </p>
          )}
          {mensaje && (
            <p role="status" className="b2 bg-amarillo t-dato negra" style={{ marginTop: 12, display: 'inline-block', padding: '6px 12px' }}>
              {mensaje}
            </p>
          )}

          <details style={{ marginTop: 20, borderTop: '2px solid #000', paddingTop: 12 }}>
            <summary className="t-micro negra mayus track" style={{ cursor: 'pointer' }}>
              Detalle tecnico (para pasarmelo)
            </summary>
            <pre className="t-dato" style={{ marginTop: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500 }}>
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        </div>
      </section>
    );
  }
}
