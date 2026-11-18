import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Modal de confirmación único para todo el panel. Se usa con una promesa:
//
//   const confirmar = useConfirmar();
//   if (!(await confirmar({ titulo: 'Guardar cambios', mensaje: '¿Guardar los cambios?' }))) return;
//
// Reemplaza al confirm() nativo del navegador y se usa en TODO botón de guardar / cancelar.
const ConfirmContext = createContext(null);

export function useConfirmar() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmar debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

// Atajos con textos estándar, para que todos los botones se comporten igual.
export const CONFIRM_GUARDAR = {
  titulo: 'Guardar cambios',
  mensaje: '¿Confirmas que quieres guardar estos cambios?',
  textoConfirmar: 'Sí, guardar',
  textoCancelar: 'Revisar',
};
export const CONFIRM_CANCELAR = {
  titulo: 'Cancelar',
  mensaje: 'Si cancelas, se pierde lo que hayas escrito o cambiado y no se guarda nada. ¿Quieres cancelar?',
  textoConfirmar: 'Sí, cancelar',
  textoCancelar: 'Seguir editando',
};

export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null);
  const resolver = useRef(null);
  const botonConfirmar = useRef(null);

  const confirmar = useCallback((opciones = {}) => new Promise((resolve) => {
    // Si ya había un modal abierto, se cierra como "no" antes de abrir el nuevo.
    if (resolver.current) resolver.current(false);
    resolver.current = resolve;
    setEstado({
      titulo: opciones.titulo || 'Confirmar',
      mensaje: opciones.mensaje || '¿Confirmas esta acción?',
      textoConfirmar: opciones.textoConfirmar || 'Sí, continuar',
      textoCancelar: opciones.textoCancelar || 'No',
      peligro: !!opciones.peligro,
    });
  }), []);

  const cerrar = useCallback((respuesta) => {
    const r = resolver.current;
    resolver.current = null;
    setEstado(null);
    if (r) r(respuesta);
  }, []);

  useEffect(() => {
    if (!estado) return;
    botonConfirmar.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') cerrar(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [estado, cerrar]);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {estado && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-titulo"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 id="confirm-titulo" className="font-display text-lg font-bold text-ink">{estado.titulo}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-ink/70">{estado.mensaje}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => cerrar(false)}
                className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">
                {estado.textoCancelar}
              </button>
              <button type="button" ref={botonConfirmar} onClick={() => cerrar(true)}
                className={`rounded-full px-6 py-2 text-sm font-semibold ${estado.peligro ? 'bg-ember text-white hover:bg-ember-light' : 'bg-gold text-night hover:bg-gold-light'}`}>
                {estado.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
