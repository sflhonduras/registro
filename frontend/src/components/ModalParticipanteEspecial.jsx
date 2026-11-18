import { useState } from 'react';
import api, { mensajeError } from '../api';
import SelectorFecha from './SelectorFecha';
import { useConfirmar, CONFIRM_GUARDAR, CONFIRM_CANCELAR } from './ConfirmProvider';
import {
  DEPARTAMENTOS_HONDURAS, MUNICIPIOS_POR_DEPARTAMENTO,
  zonasDeDepartamento, zonaValidaPara,
} from '../listas';

const NIVELES = [
  { orden: 1, nombre: 'Nivel I' }, { orden: 2, nombre: 'Nivel II' },
  { orden: 3, nombre: 'Nivel III' }, { orden: 4, nombre: 'Nivel IV' },
];

const inputCls = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20';

function Campo({ label, children }) {
  return (
    <label className="block text-sm font-medium text-ink/70">
      {label}
      {children}
    </label>
  );
}

// Alta de menores (sin DNI obligatorio) y de extranjeros (con pasaporte).
// tipo: 'menor' | 'extranjero'
export default function ModalParticipanteEspecial({ tipo, onCerrar, onCreado }) {
  const confirmar = useConfirmar();
  const esMenor = tipo === 'menor';
  const [form, setForm] = useState({
    nombre_completo: '', identificacion: '', fecha_nacimiento: '', celular: '',
    capitulo: '', zona: '', departamento: '', municipio: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    observacion: '', orden: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (esMenor && !form.fecha_nacimiento) return setError('Selecciona la fecha de nacimiento completa.');
    if (!(await confirmar({
      ...CONFIRM_GUARDAR,
      titulo: esMenor ? 'Registrar menor' : 'Registrar extranjero',
      mensaje: form.orden
        ? `Se creará el registro y se inscribirá en el Nivel ${form.orden}. ¿Continuar?`
        : 'Se creará el registro sin inscribirlo a ningún nivel. ¿Continuar?',
    }))) return;
    setGuardando(true);
    try {
      const cuerpo = {
        ...form,
        orden: form.orden ? Number(form.orden) : null,
        ...(esMenor ? { dni: form.identificacion } : { pasaporte: form.identificacion }),
      };
      const { data } = await api.post(`/admin/participantes/${tipo}`, cuerpo);
      onCreado(data);
    } catch (err) {
      const d = err.response?.data;
      setError(d?.duplicado ? d.error : mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async () => {
    if (await confirmar(CONFIRM_CANCELAR)) onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form onSubmit={guardar} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="font-display text-xl font-bold text-ink">
          {esMenor ? '+ Agregar menor' : '🌎 Agregar extranjero'}
        </h2>
        <p className="mt-1 text-sm text-ink/50">
          {esMenor
            ? 'Los menores solo se registran: no necesitan el camino de los 4 niveles. Si no tiene DNI se le asigna un código interno (MEN-00001).'
            : 'Se identifica con su número de pasaporte.'}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Nombre completo *">
              <input required className={inputCls} value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} />
            </Campo>
          </div>
          <Campo label={esMenor ? 'DNI (opcional, 13 dígitos)' : 'Número de pasaporte *'}>
            <input
              required={!esMenor} className={inputCls} value={form.identificacion}
              onChange={e => set('identificacion', esMenor
                ? e.target.value.replace(/\D/g, '').slice(0, 13)
                : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
            />
          </Campo>
          <Campo label={esMenor ? 'Fecha de nacimiento *' : 'Fecha de nacimiento'}>
            <SelectorFecha value={form.fecha_nacimiento} onChange={v => set('fecha_nacimiento', v)} />
          </Campo>
          <Campo label="Celular">
            <input className={inputCls} inputMode="numeric" value={form.celular}
              onChange={e => set('celular', e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </Campo>
          <Campo label="Capítulo">
            <input className={inputCls} value={form.capitulo} onChange={e => set('capitulo', e.target.value)} />
          </Campo>
          <Campo label="Departamento">
            <select className={inputCls} value={form.departamento}
              onChange={e => setForm(f => ({ ...f, departamento: e.target.value, municipio: '', zona: zonaValidaPara(e.target.value, f.zona) }))}>
              <option value="">—</option>
              {DEPARTAMENTOS_HONDURAS.map(d => <option key={d}>{d}</option>)}
            </select>
          </Campo>
          <Campo label="Municipio">
            <select className={inputCls} value={form.municipio} onChange={e => set('municipio', e.target.value)}>
              <option value="">—</option>
              {(MUNICIPIOS_POR_DEPARTAMENTO[form.departamento] || []).map(m => <option key={m}>{m}</option>)}
            </select>
          </Campo>
          <Campo label="Zona">
            <select className={inputCls} value={form.zona} onChange={e => set('zona', e.target.value)}>
              <option value="">—</option>
              {zonasDeDepartamento(form.departamento, form.zona).map(z => <option key={z}>{z}</option>)}
            </select>
          </Campo>
          <Campo label={esMenor ? 'Responsable (nombre) *' : 'Contacto de emergencia (nombre)'}>
            <input required={esMenor} className={inputCls} value={form.contacto_emergencia_nombre}
              onChange={e => set('contacto_emergencia_nombre', e.target.value)} />
          </Campo>
          <Campo label={esMenor ? 'Responsable (teléfono, 8 dígitos) *' : 'Contacto de emergencia (teléfono)'}>
            <input required={esMenor} className={inputCls} inputMode="numeric" value={form.contacto_emergencia_telefono}
              onChange={e => set('contacto_emergencia_telefono', e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Inscribir ahora en (opcional)">
              <select className={inputCls} value={form.orden} onChange={e => set('orden', e.target.value)}>
                <option value="">No inscribir, solo registrar</option>
                {NIVELES.map(n => <option key={n.orden} value={n.orden}>{n.nombre} (ciclo en curso)</option>)}
              </select>
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo label="Observación">
              <textarea rows={2} className={inputCls} value={form.observacion} onChange={e => set('observacion', e.target.value)} />
            </Campo>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={cancelar} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button disabled={guardando} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
