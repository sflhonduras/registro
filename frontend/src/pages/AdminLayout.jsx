import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';

const enlaces = [
  { to: '/admin/panel', label: 'Estadísticas', icon: '📊' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥' },
  { to: '/admin/diplomas', label: 'Diplomas', icon: '🎓' },
  { to: '/admin/eventos', label: 'Eventos', icon: '🗓️' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '🔑', soloAdmin: true },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const [totalRegistros, setTotalRegistros] = useState(null);

  useEffect(() => {
    api.get('/admin/estadisticas').then(r => setTotalRegistros(r.data.total_ciclo_actual)).catch(() => {});
  }, []);

  const salir = () => {
    localStorage.removeItem('sfl_token');
    localStorage.removeItem('sfl_user');
    nav('/admin');
  };

  return (
    <div className="flex min-h-[85vh] flex-col bg-parchment-2 sm:flex-row">
      <div className="flex items-center justify-between border-b border-ink/10 bg-night px-4 py-3 sm:hidden">
        <NavLink to="/" className="flex items-center gap-1.5 text-sm font-medium text-parchment/70">
          <span aria-hidden>←</span> Sitio principal
        </NavLink>
        <span className="text-xs font-semibold text-gold-light">{totalRegistros ?? '…'} registros</span>
        <div className="flex gap-3">
          {enlaces.filter(l => !l.soloAdmin || usuario?.rol === 'admin').map(l => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `text-lg ${isActive ? 'opacity-100' : 'opacity-50'}`}>
              {l.icon}
            </NavLink>
          ))}
        </div>
      </div>

      <aside className="hidden w-64 shrink-0 border-r border-ink/10 bg-night p-5 sm:block">
        <NavLink to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-parchment/50 transition hover:text-gold-light">
          <span aria-hidden>←</span> Volver al sitio principal
        </NavLink>
        <p className="text-xs uppercase tracking-[0.2em] text-gold-light">Sesión activa</p>
        <p className="mt-1 font-display text-lg font-semibold text-parchment">{usuario?.nombre}</p>
        <p className="text-xs text-parchment/50">{usuario?.rol === 'admin' ? 'Administrador' : 'Consulta (solo lectura)'}</p>

        <div className="mt-5 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-light">Registros del evento actual</p>
          <p className="font-display text-2xl font-bold text-parchment">{totalRegistros ?? '…'}</p>
        </div>

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
