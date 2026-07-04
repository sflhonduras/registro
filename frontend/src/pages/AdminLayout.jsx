import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const enlaces = [
  { to: '/admin/panel', label: 'Estadísticas', icon: '📊' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥' },
  { to: '/admin/eventos', label: 'Eventos', icon: '🗓️' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '🔑', soloAdmin: true },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');

  const salir = () => {
    localStorage.removeItem('sfl_token');
    localStorage.removeItem('sfl_user');
    nav('/admin');
  };

  return (
    <div className="flex min-h-[85vh] bg-parchment-2">
      <aside className="hidden w-64 shrink-0 border-r border-ink/10 bg-night p-5 sm:block">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-light">Sesión activa</p>
        <p className="mt-1 font-display text-lg font-semibold text-parchment">{usuario?.nombre}</p>
        <p className="text-xs text-parchment/50">{usuario?.rol === 'admin' ? 'Administrador' : 'Consulta (solo lectura)'}</p>

        <nav className="mt-8 space-y-1">
          {enlaces.filter(l => !l.soloAdmin || usuario?.rol === 'admin').map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-gold/15 text-gold-light' : 'text-parchment/70 hover:bg-parchment/5'
                }`
              }
            >
              <span>{l.icon}</span>{l.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={salir} className="mt-10 w-full rounded-lg border border-parchment/15 py-2 text-sm text-parchment/70 hover:bg-parchment/5">
          Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 overflow-x-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
