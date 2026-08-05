import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';

const enlaces = [
  { to: '/admin/panel', label: 'Estadísticas', icon: '📊', modulo: 'estadisticas' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥', modulo: 'participantes' },
  { to: '/admin/diplomas', label: 'Diplomas', icon: '🎓', modulo: 'diplomas' },
  { to: '/admin/reportes', label: 'Reportería', icon: '📋', modulo: 'reportes' },
  { to: '/admin/medallas', label: 'Medallas', icon: '🏅', modulo: 'medallas' },
  { to: '/admin/servidores', label: 'Servidores SFL', icon: '🙌', modulo: 'servidores' },
  { to: '/admin/inventario', label: 'Inventario', icon: '📦', modulo: 'inventario' },
  { to: '/admin/transporte', label: 'Transporte', icon: '🚐', modulo: 'transporte' },
  { to: '/admin/eventos', label: 'Eventos', icon: '🗓️', modulo: 'eventos' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '🔑', soloSuperAdmin: true },
  { to: '/admin/auditoria', label: 'Auditoría', icon: '🕵️', soloSuperAdmin: true },
  { to: '/admin/mantenimiento', label: 'Mantenimiento', icon: '🛠️', soloSuperAdmin: true },
];

// Paquetes fijos de los roles que no se configuran módulo por módulo — deben coincidir
// exactamente con lo que ya define auth.js en el backend, para que el menú no muestre algo
// que la API luego va a rechazar.
const MODULOS_CONSULTA_FIJO = ['estadisticas', 'reportes', 'inventario', 'transporte'];
const PRESET_ESTANDAR = new Set(['servidores', 'inventario', 'transporte']);
const PRESET_REGISTRO = new Set(['participantes', 'diplomas', 'inventario']);

const ETIQUETA_ROL = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  consulta: 'Consulta (solo lectura)',
  cocina: 'Cocina',
  estandar: 'Usuario Estándar',
  registro: 'Registro'
};

export default function AdminLayout() {
  const nav = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const [totalRegistros, setTotalRegistros] = useState(null);
  const [eventoActual, setEventoActual] = useState(null);
  const [misModulos, setMisModulos] = useState(null);

  useEffect(() => {
    api.get('/admin/evento-actual-resumen').then(r => {
      setTotalRegistros(r.data.evento_actual?.total_ciclo_actual ?? 0);
      setEventoActual(r.data.evento_actual);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (usuario?.rol === 'admin') {
      api.get('/admin/mis-permisos').then(r => setMisModulos(new Set(r.data.map(p => p.modulo)))).catch(() => setMisModulos(new Set()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puedeVer = (l) => {
    const rol = usuario?.rol;
    if (l.soloSuperAdmin) return rol === 'super_admin';
    if (rol === 'super_admin') return true;
    if (!l.modulo) return true;
    if (rol === 'consulta') return MODULOS_CONSULTA_FIJO.includes(l.modulo);
    if (rol === 'estandar') return PRESET_ESTANDAR.has(l.modulo);
    if (rol === 'registro') return PRESET_REGISTRO.has(l.modulo);
    if (rol === 'admin') return misModulos ? misModulos.has(l.modulo) : false;
    return false;
  };
  const enlacesVisibles = enlaces.filter(puedeVer);

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
          {enlacesVisibles.map(l => (
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
        <p className="text-xs text-parchment/50">{ETIQUETA_ROL[usuario?.rol] || usuario?.rol}</p>

        <div className="mt-5 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-light">Registros del evento actual</p>
          <p className="font-display text-2xl font-bold text-parchment">{totalRegistros ?? '…'}</p>
          {eventoActual && <p className="mt-0.5 text-xs text-parchment/50">{eventoActual.nombre}</p>}
        </div>

        <nav className="mt-8 space-y-1">
          {enlacesVisibles.map(l => (
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
