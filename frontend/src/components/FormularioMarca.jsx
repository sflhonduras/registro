// Piezas visuales del formulario público de inscripción (estilo asistente por pasos,
// igual al de SAEL Damas). Se reutilizan en los formularios de inscripción del SFL.

export function Boton({ children, variant = 'red', className = '', ...props }) {
  const colores = {
    red: 'bg-ember hover:bg-ember-light shadow-sm shadow-ember/20',
    green: 'bg-[#007334] hover:bg-[#005c29] shadow-sm shadow-[#007334]/20',
    blue: 'bg-[#1F3464] hover:opacity-90 shadow-sm shadow-[#1F3464]/20',
  };
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40 disabled:pointer-events-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${colores[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function BotonSecundario({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full border border-ink/20 px-6 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Encabezado({ etiqueta }) {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-night">
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-[#FDC41F]" fill="currentColor">
          <path d="M12 3c-3 3.6-5 6.2-5 9.4a5 5 0 0 0 10 0c0-2.1-.9-3.6-1.9-5 .2 1.5-.4 2.6-1.3 2.6-1 0-1.5-.9-1.2-2 .4-1.9-.2-3.4-.6-5z" />
        </svg>
      </div>
      <p className="mt-3 font-sans text-base font-bold uppercase tracking-[0.2em] text-night">{etiqueta}</p>
    </div>
  );
}

// Bandera de Honduras en SVG (el emoji 🇭🇳 no se ve bien en Windows).
export function BanderaHonduras({ className = 'h-3.5 w-5' }) {
  const estrella = '0,-1 0.22,-0.31 0.95,-0.31 0.36,0.12 0.59,0.95 0,0.5 -0.59,0.95 -0.36,0.12 -0.95,-0.31 -0.22,-0.31';
  return (
    <svg viewBox="0 0 30 20" className={className}>
      <rect width="30" height="20" fill="#0073CF" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <g fill="#0073CF">
        <polygon points={estrella} transform="translate(9,8.3) scale(0.7)" />
        <polygon points={estrella} transform="translate(15,7.7) scale(0.7)" />
        <polygon points={estrella} transform="translate(21,8.3) scale(0.7)" />
        <polygon points={estrella} transform="translate(11.5,11.5) scale(0.7)" />
        <polygon points={estrella} transform="translate(18.5,11.5) scale(0.7)" />
      </g>
    </svg>
  );
}

export function TarjetaMarca({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm ${className}`}>
      <div className="flex h-1.5">
        <span className="flex-1 bg-[#E40521]" />
        <span className="flex-1 bg-[#FDC41F]" />
        <span className="flex-1 bg-[#007334]" />
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}

export function Campo({ etiqueta, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink/70">{etiqueta}</span>
      {children}
    </label>
  );
}

// Igual que Campo, pero sin <label>: un <label> que envuelve varios botones activa
// el primero al hacer clic en cualquiera (por eso "No" no se quedaba seleccionado).
export function CampoGrupo({ etiqueta, children }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink/70">{etiqueta}</span>
      {children}
    </div>
  );
}

export const claseInput = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink transition focus:border-ember focus:outline-none focus:ring-4 focus:ring-ember/10';
