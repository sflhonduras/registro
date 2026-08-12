import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { mensajeError } from '../api';
import BotonVolver from '../components/BotonVolver';

const claseInput = 'w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-center text-lg outline-none focus:border-gold focus:ring-2 focus:ring-gold/20';

function formatearFechaHora(fecha, hora) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const fechaTexto = isNaN(d) ? fecha : d.toLocaleDateString('es-HN', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' });
  return hora ? `${fechaTexto} · ${hora.slice(0, 5)}` : fechaTexto;
}

export default function PortalServidor() {
  const [params] = useSearchParams();
  const [dni, setDni] = useState(params.get('dni') || '');
  const [pin, setPin] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [pestaña, setPestaña] = useState('info'); // 'info' | 'transporte' | 'inventario'

  const credenciales = () => ({ dni, pin });

  const entrar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const { data } = await api.post('/servidor-portal/consultar', credenciales());
      setPerfil(data);
    } catch (err) {
      setError(mensajeError(err, 'Número de identidad o PIN incorrectos.'));
    } finally {
      setCargando(false);
    }
  };

  if (!perfil) {
    return (
      <div className="mx-auto max-w-md px-5 py-24">
        <BotonVolver />
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-gold">Portal del Servidor</p>
        <h1 className="mt-1 text-center font-display text-3xl font-bold text-ink">Tu información SFL</h1>
        <p className="mt-2 text-center text-ink/60">Ingresa tu número de identidad y tu PIN personal para ver y actualizar tu información.</p>

        <form onSubmit={entrar} className="mt-8 space-y-4">
          <input required value={dni} onChange={e => setDni(e.target.value)} placeholder="Número de identidad" className={claseInput} />
          <input
            required inputMode="numeric" maxLength={4} value={pin}
            onChange={e => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            placeholder="PIN (4 dígitos)" className={`${claseInput} tracking-[0.3em]`}
          />
          {error && <p className="rounded-lg bg-ember/10 p-3 text-center text-sm text-ember">{error}</p>}
          <button disabled={cargando} className="w-full rounded-full bg-gold py-3.5 font-semibold text-night transition hover:bg-gold-light disabled:opacity-60">
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-ink/40">
          ¿No tienes tu PIN? Pídeselo a Carlos — él puede verlo o generarte uno nuevo desde el panel.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <BotonVolver />
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-gold">Portal del Servidor</p>
      <h1 className="mt-1 text-center font-display text-3xl font-bold text-ink">Hola, {perfil.nombre_completo?.split(' ')[0]}</h1>

      <div className="mt-6 flex justify-center gap-2 rounded-full bg-parchment-2 p-1">
        {[['info', 'Mi información'], ['transporte', 'Transporte'], ['inventario', 'Inventario']].map(([clave, etiqueta]) => (
          <button key={clave} onClick={() => setPestaña(clave)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${pestaña === clave ? 'bg-gold text-night' : 'text-ink/60 hover:text-ink'}`}>
            {etiqueta}
          </button>
        ))}
      </div>

      {pestaña === 'info' && <TabInformacion perfil={perfil} setPerfil={setPerfil} credenciales={credenciales} />}
      {pestaña === 'transporte' && <TabTransporte credenciales={credenciales} />}
      {pestaña === 'inventario' && <TabInventario credenciales={credenciales} />}

      <div className="mt-8 text-center">
        <button onClick={() => { setPerfil(null); setPin(''); }} className="text-sm text-ink/40 underline hover:text-ink">
          Salir
        </button>
      </div>
    </div>
  );
}

function Tarjeta({ children }) {
  return <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">{children}</div>;
}

function TabInformacion({ perfil, setPerfil, credenciales }) {
  const [editando, setEditando] = useState(false);
  const [celular, setCelular] = useState(perfil.celular || '');
  const [email, setEmail] = useState(perfil.email || '');
  const [foto, setFoto] = useState(perfil.foto || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const inputFotoRef = useRef(null);

  const [diasLocal, setDiasLocal] = useState(perfil.dias_asistencia);
  const [guardandoDias, setGuardandoDias] = useState(false);

  const subirFoto = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setFoto(lector.result);
    lector.readAsDataURL(archivo);
  };

  const guardarDatos = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      const { data } = await api.put('/servidor-portal/mis-datos', { ...credenciales(), celular, email, foto });
      setPerfil(data);
      setMensaje('✓ Tus datos quedaron actualizados.');
      setEditando(false);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const toggleDia = async (dia) => {
    const nuevos = { ...diasLocal, [dia]: !diasLocal[dia] };
    setDiasLocal(nuevos);
    setGuardandoDias(true);
    try {
      const { data } = await api.put('/servidor-portal/dias-asistencia', { ...credenciales(), ...nuevos });
      setDiasLocal(data.dias_asistencia);
      setPerfil(p => ({ ...p, participara_evento: data.participara_evento }));
    } catch {
      setDiasLocal(diasLocal); // revierte si falla
    } finally {
      setGuardandoDias(false);
    }
  };

  return (
    <>
      <Tarjeta>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Capítulo</p>
        <p className="mt-1 font-semibold text-ink">{perfil.capitulo || '—'}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Cargo actual</p>
        <p className="mt-1 font-semibold text-ink">{perfil.cargo_actual || '—'}</p>
      </Tarjeta>

      <Tarjeta>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">¿Participarás en el evento actual?</p>
        <div className="flex justify-center gap-3">
          {[['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']].map(([clave, etiqueta]) => (
            <button key={clave} type="button" disabled={guardandoDias} onClick={() => toggleDia(clave)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                diasLocal[clave] ? 'bg-gold text-night' : 'bg-ink/5 text-ink/50'
              }`}>
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink/40">Toca el día que NO te aplique para desmarcarlo. Se guarda al instante.</p>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Mis datos de contacto</p>
          <button onClick={() => setEditando(v => !v)} className="text-sm font-semibold text-gold hover:underline">
            {editando ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {!editando ? (
          <div className="mt-3 space-y-2 text-sm">
            <p><strong className="text-ink/70">Celular:</strong> {perfil.celular || '—'}</p>
            <p><strong className="text-ink/70">Email:</strong> {perfil.email || '—'}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="Celular"
              className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5" />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
              className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5" />
            <div className="flex items-center gap-3">
              {foto && <img src={foto} alt="Foto" className="h-16 w-14 rounded-lg border border-ink/10 object-cover" />}
              <input ref={inputFotoRef} type="file" accept="image/*" onChange={subirFoto} className="hidden" />
              <button type="button" onClick={() => inputFotoRef.current?.click()}
                className="rounded-full border border-ink/20 px-4 py-2 text-sm font-medium hover:bg-ink/5">
                {foto ? '📷 Cambiar foto' : '📷 Subir foto'}
              </button>
            </div>
            {error && <p className="rounded-lg bg-ember/10 p-2 text-sm text-ember">{error}</p>}
            <button onClick={guardarDatos} disabled={guardando}
              className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
        {mensaje && <p className="mt-3 rounded-lg bg-palm/10 p-2 text-center text-sm text-palm">{mensaje}</p>}
      </Tarjeta>
    </>
  );
}

function TabTransporte({ credenciales }) {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => {
    setCargando(true);
    api.post('/servidor-portal/transporte', credenciales())
      .then(r => setEstado(r.data))
      .catch(err => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unirme = async (transporteId) => {
    setProcesando(true); setError('');
    try {
      await api.post('/servidor-portal/transporte/unirme', { ...credenciales(), transporte_id: transporteId });
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setProcesando(false);
    }
  };

  const salir = async () => {
    setProcesando(true); setError('');
    try {
      await api.post('/servidor-portal/transporte/salir', credenciales());
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <Tarjeta><p className="text-center text-ink/40">Cargando…</p></Tarjeta>;
  if (!estado?.evento) return <Tarjeta><p className="text-center text-ink/40">No hay ningún evento activo por ahora.</p></Tarjeta>;

  return (
    <Tarjeta>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{estado.evento.nombre}</p>
      <p className="mt-1 mb-4 text-sm text-ink/60">Puedes estar en un solo vehículo a la vez — únete al que te convenga, y puedes cambiarte cuando quieras.</p>

      {error && <p className="mb-3 rounded-lg bg-ember/10 p-2 text-sm text-ember">{error}</p>}

      {estado.disponibles.length === 0 && (
        <p className="text-center text-sm text-ink/40">Todavía no hay vehículos registrados para este evento — pregúntale a Carlos.</p>
      )}

      <div className="space-y-3">
        {estado.disponibles.map(t => {
          const esMio = t.id === estado.mi_transporte_id;
          return (
            <div key={t.id} className={`rounded-xl border p-4 ${esMio ? 'border-gold bg-gold/5' : 'border-ink/10'}`}>
              <p className="font-semibold text-ink">{t.ciudad} · {t.tipo_vehiculo_nombre}</p>
              <p className="text-sm text-ink/60">{formatearFechaHora(t.fecha_salida, t.hora_salida)}</p>
              {t.conductor_nombre && <p className="text-sm text-ink/50">Conductor: {t.conductor_nombre}</p>}
              <p className="mt-1 text-xs text-ink/40">{t.ocupados}/{t.capacidad} ocupados{t.lleno ? ' · LLENO' : ''}</p>
              {esMio ? (
                <button onClick={salir} disabled={procesando}
                  className="mt-2 rounded-full bg-ember px-4 py-1.5 text-xs font-semibold text-white hover:bg-ember-light disabled:opacity-50">
                  Salir de este transporte
                </button>
              ) : (
                <button onClick={() => unirme(t.id)} disabled={procesando || t.lleno}
                  className="mt-2 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-night hover:bg-gold-light disabled:opacity-50">
                  {t.lleno ? 'Lleno' : 'Unirme'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
}

function TabInventario({ credenciales }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.post('/servidor-portal/inventario', credenciales()).then(r => setDatos(r.data)).finally(() => setCargando(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <Tarjeta><p className="text-center text-ink/40">Cargando…</p></Tarjeta>;

  return (
    <>
      <p className="mt-4 text-center text-xs text-ink/40">Solo consulta — los cambios los hace Carlos desde el panel.</p>
      {(datos?.categorias || []).map(cat => (
        <Tarjeta key={cat.id}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{cat.nombre}</p>
          <div className="mt-2 space-y-1.5">
            {cat.items.map(it => (
              <div key={it.id} className="flex items-center justify-between text-sm">
                <span className="text-ink/80">{it.nombre}</span>
                <span className="font-semibold text-ink">
                  {it.cantidad_actual ?? '—'}{it.tipo_medida === 'porcentaje' && it.cantidad_actual != null ? '%' : ''}
                </span>
              </div>
            ))}
            {cat.items.length === 0 && <p className="text-sm text-ink/40">Sin ítems.</p>}
          </div>
        </Tarjeta>
      ))}
    </>
  );
}
