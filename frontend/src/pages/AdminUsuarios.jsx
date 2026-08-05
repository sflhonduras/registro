import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api';

const ETIQUETA_ROL = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  consulta: 'Consulta',
  cocina: 'Cocina',
  estandar: 'Usuario Estándar',
  registro: 'Registro'
};

const COLOR_ROL = {
  super_admin: 'bg-night text-gold-light',
  admin: 'bg-ember/10 text-ember',
  cocina: 'bg-palm/10 text-palm',
  estandar: 'bg-gold/10 text-gold',
  registro: 'bg-palm/10 text-palm',
  consulta: 'bg-ink/10 text-ink/60'
};

// Descripción fija para los roles que NO se configuran módulo por módulo — son paquetes
// iguales para todos los que tengan ese rol.
const DESCRIPCION_FIJA = {
  estandar: 'Servidores SFL (solo ver) · Inventario (editar) · Transporte (editar)',
  registro: 'Participantes (checkbox "Registrado" e "Imprimir etiqueta") · Diplomas (descargar Excel/PDF) · Inventario (completo)'
};

const ETIQUETA_NIVEL = { consulta: 'Consulta (solo ver)', edicion: 'Edición (ver y modificar)' };

function PanelPermisos({ usuario, modulos, onCerrar }) {
  const [permisos, setPermisos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/admin/usuarios/${usuario.id}/permisos`).then(r => {
      const mapa = {};
      r.data.forEach(p => { mapa[p.modulo] = p.nivel; });
      setPermisos(mapa);
    }).catch(() => setError('No se pudieron cargar los permisos actuales.')).finally(() => setCargando(false));
  }, [usuario.id]);

  const guardar = async () => {
    setGuardando(true); setError('');
    const lista = Object.entries(permisos)
      .filter(([, nivel]) => nivel)
      .map(([modulo, nivel]) => ({ modulo, nivel }));
    try {
      await api.put(`/admin/usuarios/${usuario.id}/permisos`, { permisos: lista });
      onCerrar(true);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="font-display text-lg font-bold text-ink">Permisos de {usuario.nombre}</p>
        <p className="mt-1 text-xs text-ink/50">
          Elige, módulo por módulo, si este Administrador puede solo ver, o también editar. Si dejas "Sin acceso", no le va a
          aparecer esa sección en el panel. Usuarios, Auditoría y Mantenimiento nunca aparecen aquí — esas son exclusivas
          del Super Administrador.
        </p>

        {cargando ? (
          <p className="mt-4 text-sm text-ink/50">Cargando…</p>
        ) : (
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {modulos.map(m => (
              <label key={m.clave} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink/70">{m.etiqueta}</span>
                <select
                  value={permisos[m.clave] || ''}
                  onChange={e => setPermisos(p => ({ ...p, [m.clave]: e.target.value }))}
                  className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                >
                  <option value="">Sin acceso</option>
                  <option value="consulta">{ETIQUETA_NIVEL.consulta}</option>
                  <option value="edicion">{ETIQUETA_NIVEL.edicion}</option>
                </select>
              </label>
            ))}
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-ember/10 p-2 text-xs text-ember">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => onCerrar(false)} className="rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || cargando}
            className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'consulta' });
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [usuarioPermisos, setUsuarioPermisos] = useState(null);

  const cargar = () => api.get('/admin/usuarios').then(r => setUsuarios(r.data));
  useEffect(() => {
    cargar();
    api.get('/admin/modulos-disponibles').then(r => setModulos(r.data)).catch(() => {});
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setCreando(true);
    try {
      const { data: nuevoUsuario } = await api.post('/admin/usuarios', form);
      const rolCreado = form.rol;
      setForm({ nombre: '', email: '', password: '', rol: 'consulta' });
      cargar();
      if (rolCreado === 'admin' && nuevoUsuario?.id) {
        setUsuarioPermisos({ id: nuevoUsuario.id, nombre: nuevoUsuario.nombre });
      }
    } catch (err) { setError(mensajeError(err)); } finally { setCreando(false); }
  };

  const toggleActivo = async (u) => {
    await api.put(`/admin/usuarios/${u.id}`, { activo: !u.activo });
    cargar();
  };

  const eliminar = async (u) => {
    if (!confirm(`¿Eliminar el usuario ${u.email}?`)) return;
    await api.delete(`/admin/usuarios/${u.id}`);
    cargar();
  };

  const cambiarContrasena = async (u) => {
    const nueva = prompt(`Nueva contraseña para ${u.email} (mínimo 6 caracteres):`);
    if (nueva === null) return;
    if (nueva.trim().length < 6) { alert('La contraseña debe tener al menos 6 caracteres.'); return; }
    try {
      await api.put(`/admin/usuarios/${u.id}`, { password: nueva.trim() });
      alert(`Contraseña de ${u.email} actualizada correctamente.`);
    } catch (err) {
      alert(mensajeError(err));
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Usuarios del panel</h1>
      <p className="text-sm text-ink/50">
        El <strong>Super Administrador</strong> tiene control total, incluyendo Usuarios, Auditoría y Mantenimiento. Los
        <strong> Administradores</strong> ven o editan solo los módulos que el Super Administrador les habilite. <strong>Consulta</strong>,
        {' '}<strong>Estándar</strong> y <strong>Registro</strong> son paquetes fijos, iguales para todos los que tengan ese rol.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form onSubmit={crear} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm lg:col-span-1">
          <p className="font-semibold text-ink">Nuevo usuario</p>
          <input required placeholder="Nombre" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <input required type="email" placeholder="Correo electrónico" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input required type="password" placeholder="Contraseña" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <select className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
            <option value="consulta">Consulta (Estadísticas/Reportería/Inventario/Transporte, solo ver)</option>
            <option value="admin">Administrador (tú le configuras qué módulos ve o edita)</option>
            <option value="cocina">Cocina (solo ve el resumen de asistentes)</option>
            <option value="estandar">Usuario Estándar (Servidores-ver, Inventario/Transporte-editar)</option>
            <option value="registro">Registro (checkboxes de Participantes, Diplomas, Inventario completo)</option>
          </select>
          {form.rol === 'admin' && (
            <p className="rounded-lg bg-gold/10 p-2 text-xs text-ink/60">
              Al crear el usuario, te voy a pedir de una vez qué módulos puede ver o editar — si no, no tendrá acceso a nada todavía.
            </p>
          )}
          {(form.rol === 'estandar' || form.rol === 'registro') && (
            <p className="rounded-lg bg-gold/10 p-2 text-xs text-ink/60">
              Este rol trae un paquete de permisos fijo: {DESCRIPCION_FIJA[form.rol]}
            </p>
          )}
          {error && <p className="rounded-lg bg-ember/10 p-2 text-xs text-ember">{error}</p>}
          <button disabled={creando} className="w-full rounded-full bg-gold py-2 text-sm font-semibold text-night hover:bg-gold-light">
            {creando ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
              <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-medium text-ink">{u.nombre}</td>
                  <td className="px-4 py-3 text-ink/60">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_ROL[u.rol] || 'bg-ink/10 text-ink/60'}`}>
                      {ETIQUETA_ROL[u.rol] || u.rol}
                    </span>
                    {DESCRIPCION_FIJA[u.rol] && (
                      <p className="mt-1 text-[11px] text-ink/40">{DESCRIPCION_FIJA[u.rol]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.rol === 'admin' && (
                      <button onClick={() => setUsuarioPermisos(u)} className="text-gold hover:underline">Permisos</button>
                    )}
                    <button onClick={() => cambiarContrasena(u)} className="ml-3 text-ink/60 hover:underline">Cambiar contraseña</button>
                    <button onClick={() => toggleActivo(u)} className="ml-3 text-gold hover:underline">{u.activo ? 'Desactivar' : 'Activar'}</button>
                    {u.rol !== 'super_admin' && (
                      <button onClick={() => eliminar(u)} className="ml-3 text-ember hover:underline">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {usuarioPermisos && (
        <PanelPermisos
          usuario={usuarioPermisos}
          modulos={modulos}
          onCerrar={() => setUsuarioPermisos(null)}
        />
      )}
    </div>
  );
}
