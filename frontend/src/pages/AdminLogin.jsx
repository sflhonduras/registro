import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { mensajeError } from '../api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const nav = useNavigate();

  const entrar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('sfl_token', data.token);
      localStorage.setItem('sfl_user', JSON.stringify(data.usuario));
      nav('/admin/panel');
    } catch (err) {
      setError(mensajeError(err, 'Correo o contraseña incorrectos.'));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-night px-5">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border border-gold/20 bg-night-2 p-8 shadow-2xl">
        <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-parchment/50 transition hover:text-gold-light">
          <span aria-hidden>←</span> Volver al sitio principal
        </Link>
        <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">Acceso restringido</p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-parchment">Panel administrativo SFL</h1>
        <div className="mt-6 space-y-4">
          <input
            required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico"
            className="w-full rounded-lg border border-parchment/15 bg-night px-4 py-2.5 text-parchment outline-none focus:border-gold"
          />
          <input
            required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
            className="w-full rounded-lg border border-parchment/15 bg-night px-4 py-2.5 text-parchment outline-none focus:border-gold"
          />
        </div>
        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember-light">{error}</p>}
        <button disabled={cargando} className="mt-6 w-full rounded-full bg-gold py-2.5 font-semibold text-night hover:bg-gold-light disabled:opacity-60">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
