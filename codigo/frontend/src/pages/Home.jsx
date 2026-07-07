import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Contador from '../components/Contador';
import InfoEvento from '../components/InfoEvento';
import PromoWhatsApp from '../components/PromoWhatsApp';

const ICONOS = ['🕊️', '🪞', '🤝', '🔥'];

export default function Home() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/eventos')
      .then(r => setEventos(r.data))
      .catch(() => setError('No se pudo cargar la información de los eventos. Intenta recargar la página.'));
  }, []);

  // Cuenta regresiva hacia el cierre de inscripción más próximo entre los niveles abiertos
  const proximoCierre = eventos
    ?.filter(ev => ev.abierto && ev.fecha_limite_registro)
    .sort((a, b) => new Date(a.fecha_limite_registro) - new Date(b.fecha_limite_registro))[0];

  const eventoActivo = eventos?.find(ev => ev.es_actual) || eventos?.[0];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-night grain-overlay">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-ember/20 blur-3xl" />
        <div className="mx-auto max-w-5xl px-5 pb-20 pt-16 text-center">
          <p className="mb-4 inline-block rounded-full border border-gold/30 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">
            FIHNEC · Fraternidad Internacional de Hombres de Negocios del Evangelio Completo
          </p>
          <h1 className="font-display text-4xl font-bold text-parchment sm:text-6xl">
            Seminario para la <span className="text-gold-light">Formación de Líderes</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-parchment/70">
            Una jornada de cuatro encuentros, uno a la vez. Cada nivel abre la puerta al siguiente:
            así como un liderazgo firme, se construye en orden y sobre un fundamento sólido.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#jornada" className="rounded-full bg-gold px-7 py-3 font-semibold text-night shadow-lg shadow-gold/20 transition hover:bg-gold-light">
              Ver la jornada SFL
            </a>
            <Link to={`/registro/${eventoActivo?.orden || 1}`} className="rounded-full border border-parchment/30 px-7 py-3 font-semibold text-parchment transition hover:bg-parchment/10">
              Inscríbete aquí
            </Link>
          </div>

          {proximoCierre && (
            <Contador
              fechaObjetivo={proximoCierre.fecha_limite_registro}
              etiqueta={`Cierre de inscripción · ${proximoCierre.nombre}`}
            />
          )}
        </div>
      </section>

      {/* JORNADA */}
      <section id="jornada" className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">La jornada, en cuatro niveles</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-ink/60">
          El registro es estrictamente secuencial. Para inscribirte a un nivel, debes haber completado el anterior —
          no es posible saltar pasos.
        </p>

        {error && <p className="mt-8 rounded-lg bg-ember/10 p-4 text-center text-ember">{error}</p>}

        <div className="relative mt-14">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-gold via-gold/40 to-transparent sm:left-1/2 sm:hidden" />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(eventos || [1, 2, 3, 4].map(orden => ({ orden, nombre: '', cargando: true }))).map((ev, idx) => (
              <li key={ev.orden} className="relative rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-pale font-display text-lg font-bold text-ember">
                    {String(ev.orden).padStart(2, '0')}
                  </span>
                  <span className="text-2xl">{ICONOS[idx]}</span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-ink">
                  {ev.cargando ? 'Cargando…' : ev.nombre}
                </h3>
                {!ev.cargando && (
                  <>
                    <p className="mt-2 min-h-10 text-sm text-ink/60">{ev.descripcion}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <span className={`h-2 w-2 rounded-full ${ev.abierto ? 'bg-palm' : 'bg-ember'}`} />
                      <span className={ev.abierto ? 'text-palm' : 'text-ember'}>
                        {ev.abierto ? 'Registro abierto' : 'Registro cerrado'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <InfoEvento evento={ev} compacto />
                    </div>
                    <Link
                      to={`/registro/${ev.orden}`}
                      className={`mt-5 block rounded-full py-2.5 text-center text-sm font-semibold transition ${
                        ev.abierto ? 'bg-ink text-parchment hover:bg-ember' : 'cursor-not-allowed bg-ink/10 text-ink/40'
                      }`}
                    >
                      {ev.orden === 1 ? 'Inscribirme' : 'Verificar / Inscribirme'}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-parchment-2 py-16">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">¿Cómo funciona el registro?</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-3xl font-bold text-gold">1</p>
              <p className="mt-2 font-semibold text-ink">Regístrate una sola vez</p>
              <p className="mt-1 text-sm text-ink/60">En el Nivel I completas tu formulario con tus datos. Quedan guardados para siempre.</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-gold">2</p>
              <p className="mt-2 font-semibold text-ink">Del Nivel II en adelante, solo tu DNI</p>
              <p className="mt-1 text-sm text-ink/60">El sistema verifica automáticamente si ya completaste el nivel anterior.</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-gold">3</p>
              <p className="mt-2 font-semibold text-ink">Un nivel a la vez</p>
              <p className="mt-1 text-sm text-ink/60">Si aún no estás habilitado, el sistema te lo indicará y no podrás avanzar de paso.</p>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-xl">
            <PromoWhatsApp />
          </div>
        </div>
      </section>
    </div>
  );
}
