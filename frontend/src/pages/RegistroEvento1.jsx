import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { mensajeError } from '../api';

const VACIO = {
  nombre_completo: '', dni: '', celular: '', capitulo: '', zona: '', departamento: '', municipio: '',
  cargo_fihnec: '', estado_civil: '', hijos_cantidad: '', comparte_testimonio: '', tiempo_comparte_testimonio: '',
  ha_recibido_sael: '', cantidad_saeles: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', observacion: ''
};

function Campo({ label, children, requerido }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80">
        {label} {requerido && <span className="text-ember">*</span>}
      </span>
      {children}
    </label>
  );
}

const claseInput = "w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20";

export default function RegistroEvento1() {
  const [form, setForm] = useState(VACIO);
  const [evento, setEvento] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/eventos/1/estado').then(r => setEvento(r.data)).catch(() => {});
  }, []);

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await api.post('/registro/evento1', form);
      setExito(r.data.mensaje);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  if (exito) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-5xl">🔥</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{exito}</h1>
        <p className="mt-3 text-ink/60">Guarda tu número de identidad (DNI): lo necesitarás para inscribirte a los siguientes niveles.</p>
        <button onClick={() => nav('/')} className="mt-8 rounded-full bg-ink px-6 py-2.5 font-semibold text-parchment hover:bg-ember">
          Volver al inicio
        </button>
      </div>
    );
  }

  if (evento && !evento.abierto) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Registro cerrado</h1>
        <p className="mt-3 text-ink/60">El registro para el SFL Nivel I no está disponible en este momento.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">Nivel I · Mi Relación con Dios</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-ink">Formulario de inscripción</h1>
      <p className="mt-2 text-ink/60">Completa tus datos una única vez. Servirán para tu registro en los siguientes niveles del SFL.</p>

      <form onSubmit={enviar} className="mt-8 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Nombre completo" requerido>
              <input required className={claseInput} value={form.nombre_completo} onChange={set('nombre_completo')} placeholder="Ej. Juan Carlos Pérez López" />
            </Campo>
          </div>
          <Campo label="Número de identidad (DNI)" requerido>
            <input required className={claseInput} value={form.dni} onChange={set('dni')} placeholder="0801-1990-00000" />
          </Campo>
          <Campo label="Número de celular">
            <input className={claseInput} value={form.celular} onChange={set('celular')} placeholder="9999-9999" />
          </Campo>
          <Campo label="Capítulo al que pertenece">
            <input className={claseInput} value={form.capitulo} onChange={set('capitulo')} />
          </Campo>
          <Campo label="Zona">
            <input className={claseInput} value={form.zona} onChange={set('zona')} />
          </Campo>
          <Campo label="Departamento">
            <input className={claseInput} value={form.departamento} onChange={set('departamento')} />
          </Campo>
          <Campo label="Municipio">
            <input className={claseInput} value={form.municipio} onChange={set('municipio')} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Cargo en FIHNEC">
              <input className={claseInput} value={form.cargo_fihnec} onChange={set('cargo_fihnec')} />
            </Campo>
          </div>
          <Campo label="Estado civil">
            <select className={claseInput} value={form.estado_civil} onChange={set('estado_civil')}>
              <option value="">Selecciona…</option>
              {['Soltero', 'Casado', 'Unión libre', 'Divorciado', 'Viudo'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Campo>
          <Campo label="Cantidad de hijos">
            <input type="number" min="0" className={claseInput} value={form.hijos_cantidad} onChange={set('hijos_cantidad')} />
          </Campo>
          <Campo label="¿Comparte testimonio?">
            <select className={claseInput} value={form.comparte_testimonio} onChange={set('comparte_testimonio')}>
              <option value="">Selecciona…</option>
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
          </Campo>
          <Campo label="¿Hace cuánto tiempo comparte testimonio?">
            <input className={claseInput} value={form.tiempo_comparte_testimonio} onChange={set('tiempo_comparte_testimonio')} />
          </Campo>
          <Campo label="¿Ha recibido SAEL?">
            <select className={claseInput} value={form.ha_recibido_sael} onChange={set('ha_recibido_sael')}>
              <option value="">Selecciona…</option>
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
          </Campo>
          <Campo label="¿Cuántos SAELES ha recibido?">
            <input type="number" min="0" className={claseInput} value={form.cantidad_saeles} onChange={set('cantidad_saeles')} />
          </Campo>
          <Campo label="Nombre del contacto de emergencia">
            <input className={claseInput} value={form.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')} />
          </Campo>
          <Campo label="Teléfono del contacto de emergencia">
            <input className={claseInput} value={form.contacto_emergencia_telefono} onChange={set('contacto_emergencia_telefono')} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Observaciones">
              <textarea rows={3} className={claseInput} value={form.observacion} onChange={set('observacion')} />
            </Campo>
          </div>
        </div>

        {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

        <button disabled={enviando} className="w-full rounded-full bg-gold py-3.5 font-semibold text-night transition hover:bg-gold-light disabled:opacity-60">
          {enviando ? 'Enviando…' : 'Completar inscripción'}
        </button>
      </form>
    </div>
  );
}
