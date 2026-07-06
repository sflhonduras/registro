import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'consulta' });
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = () => api.get('/admin/usuarios').then(r => setUsuarios(r.data));
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setCreando(true);
    try {
      await api.post('/admin/usuarios', form);
      setForm({ nombre: '', email: '', password: '', rol: 'consulta' });
      cargar();
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
    if (nueva === null) return; // canceló
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
      <p className="text-sm text-ink/50">Administradores tienen control total. Los de consulta solo pueden ver información.</p>

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
            <option value="consulta">Consulta (solo lectura)</option>
            <option value="admin">Administrador (control total)</option>
            <option value="cocina">Cocina (solo ve el resumen de asistentes)</option>
          </select>
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
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.rol === 'admin' ? 'bg-ember/10 text-ember' : u.rol === 'cocina' ? 'bg-palm/10 text-palm' : 'bg-gold/10 text-gold'
                    }`}>
                      {u.rol === 'admin' ? 'Administrador' : u.rol === 'cocina' ? 'Cocina' : 'Consulta'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => cambiarContrasena(u)} className="text-ink/60 hover:underline">Cambiar contraseña</button>
                    <button onClick={() => toggleActivo(u)} className="ml-3 text-gold hover:underline">{u.activo ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => eliminar(u)} className="ml-3 text-ember hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
