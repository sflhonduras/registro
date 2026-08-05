import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { mensajeError } from '../api';

const ORDEN_MODULOS = ['estadisticas', 'participantes', 'diplomas', 'reportes', 'medallas', 'servidores', 'inventario', 'transporte', 'eventos'];
const RUTA_POR_MODULO = {
  estadisticas: '/admin/panel', participantes: '/admin/participantes', diplomas: '/admin/diplomas',
  reportes: '/admin/reportes', medallas: '/admin/medallas', servidores: '/admin/servidores',
  inventario: '/admin/inventario', transporte: '/admin/transporte', eventos: '/admin/eventos'
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const nav = useNavigate();

  // 'credenciales' -> 'configurar' (primera vez con 2FA) o 'codigo' (2FA ya activado)
  const [paso, setPaso] = useState('credenciales');
  const [qr, setQr] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nombrePendiente, setNombrePendiente] = useState('');

  // Manda a la persona al primer módulo al que sí tiene acceso, en vez de asumir que todos
  // empiezan en Estadísticas.
  const irADestinoFinal = async (usuario) => {
    if (usuario.rol === 'cocina') { nav('/admin/cocina'); return; }
    if (usuario.rol === 'super_admin') { nav('/admin/panel'); return; }
    try {
      const { data: permisos } = await api.get('/admin/mis-permisos');
      const misModulos = new Set(permisos.map(p => p.modulo));
      const primerModulo = ORDEN_MODULOS.find(m => misModulos.has(m));
      nav(primerModulo ? RUTA_POR_MODULO[primerModulo] : '/admin/panel');
    } catch {
      nav('/admin/panel');
    }
  };

  const guardarSesionCompleta = async (data) => {
    localStorage.setItem('sfl_token', data.token);
    localStorage.setItem('sfl_user', JSON.stringify(data.usuario));
    await irADestinoFinal(data.usuario);
  };

  const entrar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });

      if (data.requiere_configurar_2fa) {
        // Token temporal (5 min) — solo sirve para terminar de configurar 2FA, para nada más.
        localStorage.setItem('sfl_token', data.token);
        setNombrePendiente(data.usuario?.nombre || '');
        const { data: qrData } = await api.get('/auth/2fa/qr');
        setQr(qrData.qr);
        setPaso('configurar');
        return;
      }

      if (data.requiere_codigo_2fa) {
        localStorage.setItem('sfl_token', data.token);
        setNombrePendiente(data.usuario?.nombre || '');
        setPaso('codigo');
        return;
      }

      await guardarSesionCompleta(data);
    } catch (err) {
      setError(mensajeError(err, 'Correo o contraseña incorrectos.'));
    } finally {
      setCargando(false);
    }
  };

  const confirmarConfiguracion = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const { data } = await api.post('/auth/2fa/confirmar-setup', { codigo });
      await guardarSesionCompleta(data);
    } catch (err) {
      setError(mensajeError(err, 'Código incorrecto.'));
    } finally {
      setCargando(false);
    }
  };

  const enviarCodigo = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const { data } = await api.post('/auth/2fa/verificar', { codigo });
      await guardarSesionCompleta(data);
    } catch (err) {
      setError(mensajeError(err, 'Código incorrecto.'));
    } finally {
      setCargando(false);
    }
  };

  const claseInput = 'w-full rounded-lg border border-parchment/15 bg-night px-4 py-2.5 text-parchment outline-none focus:border-gold';

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-night px-5">
      <div className="w-full max-w-sm rounded-2xl border border-gold/20 bg-night-2 p-8 shadow-2xl">
        <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-parchment/50 transition hover:text-gold-light">
          <span aria-hidden>←</span> Volver al sitio principal
        </Link>
        <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">Acceso restringido</p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-parchment">Panel administrativo SFL</h1>

        {paso === 'credenciales' && (
          <form onSubmit={entrar} className="mt-6 space-y-4">
            <input
              required type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico o usuario"
              className={claseInput}
            />
            <input
              required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
              className={claseInput}
            />
            {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember-light">{error}</p>}
            <button disabled={cargando} className="w-full rounded-full bg-gold py-2.5 font-semibold text-night hover:bg-gold-light disabled:opacity-60">
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}

        {paso === 'configurar' && (
          <form onSubmit={confirmarConfiguracion} className="mt-6 space-y-4">
            <p className="text-center text-sm text-parchment/70">
              Hola {nombrePendiente} — tu cuenta requiere doble autenticación. Es la primera vez, así que hay que configurarla:
            </p>
            <ol className="space-y-1 text-xs text-parchment/50">
              <li>1. Abre Google Authenticator (o cualquier app similar) en tu celular.</li>
              <li>2. Escanea este código QR:</li>
            </ol>
            {qr ? (
              <img src={qr} alt="Código QR para 2FA" className="mx-auto h-44 w-44 rounded-lg border border-parchment/15 bg-white p-2" />
            ) : (
              <p className="text-center text-sm text-parchment/50">Cargando código QR…</p>
            )}
            <p className="text-center text-xs text-parchment/50">3. Escribe aquí el código de 6 dígitos que te muestra la app:</p>
            <input
              required maxLength={6} inputMode="numeric" placeholder="123456" value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              className={`${claseInput} text-center text-2xl tracking-[0.3em]`}
            />
            {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember-light">{error}</p>}
            <button disabled={cargando || codigo.length !== 6} className="w-full rounded-full bg-gold py-2.5 font-semibold text-night hover:bg-gold-light disabled:opacity-60">
              {cargando ? 'Verificando…' : 'Activar y entrar'}
            </button>
          </form>
        )}

        {paso === 'codigo' && (
          <form onSubmit={enviarCodigo} className="mt-6 space-y-4">
            <p className="text-center text-sm text-parchment/70">
              Hola {nombrePendiente} — abre tu app autenticadora y escribe el código de 6 dígitos:
            </p>
            <input
              required maxLength={6} inputMode="numeric" autoFocus placeholder="123456" value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              className={`${claseInput} text-center text-2xl tracking-[0.3em]`}
            />
            {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember-light">{error}</p>}
            <button disabled={cargando || codigo.length !== 6} className="w-full rounded-full bg-gold py-2.5 font-semibold text-night hover:bg-gold-light disabled:opacity-60">
              {cargando ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
