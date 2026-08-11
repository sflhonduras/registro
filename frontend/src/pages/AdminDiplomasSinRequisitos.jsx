import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensajeError } from '../api';
import { numeroARomano } from '../romano';
import { ZONAS_FIHNEC, DEPARTAMENTOS_HONDURAS, MUNICIPIOS_POR_DEPARTAMENTO, CARGOS_FIHNEC } from '../listas';

const VACIO = {
  nombre_completo: '', dni: '', celular: '', capitulo: '', zona: '', departamento: '', municipio: '',
  cargo_fihnec: '', estado_civil: '', hijos_cantidad: '', comparte_testimonio: '',
  tiempo_comparte_cantidad: '', tiempo_comparte_unidad: 'Meses',
  ha_recibido_sael: '', cantidad_saeles: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: ''
};

const claseInput = 'w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20';

function Campo({ label, children, requerido = true }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink/80">
        {label} {requerido && <span className="text-ember">*</span>}
      </span>
      {children}
    </label>
  );
}

// Modal paso a paso: DNI -> (si existe, historial) -> formulario de datos que falten -> guardar
function ModalRegistrar({ onCerrar, onGuardado }) {
  const [paso, setPaso] = useState('dni'); // 'dni' | 'historial' | 'formulario'
  const [dniConsulta, setDniConsulta] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorDni, setErrorDni] = useState('');
  const [participanteExistente, setParticipanteExistente] = useState(null);
  const [inscripcionesExistente, setInscripcionesExistente] = useState([]);

  const [form, setForm] = useState(VACIO);
  const [nivelCompletado, setNivelCompletado] = useState(0);
  const [eventoAsistido, setEventoAsistido] = useState('2');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));
  const cambiarDepartamento = (e) => setForm(f => ({ ...f, departamento: e.target.value, municipio: '' }));
  const municipiosDisponibles = useMemo(() => MUNICIPIOS_POR_DEPARTAMENTO[form.departamento] || [], [form.departamento]);

  const verificarDni = async (e) => {
    e.preventDefault();
    setErrorDni(''); setVerificando(true);
    try {
      const { data } = await api.get(`/admin/participantes-excepcion/verificar/${dniConsulta}`);
      if (!data.existe) {
        setForm(f => ({ ...f, dni: dniConsulta }));
        setPaso('formulario');
      } else if (data.ya_tiene_excepcion_abierta) {
        setErrorDni('Este participante ya tiene un registro abierto en Participantes Sin Requisitos. Búscalo en la lista para actualizarlo, en vez de crear uno nuevo.');
      } else {
        setParticipanteExistente(data.participante);
        setInscripcionesExistente(data.inscripciones);
        setPaso('historial');
      }
    } catch {
      setErrorDni('No se pudo verificar el DNI. Intenta de nuevo.');
    } finally {
      setVerificando(false);
    }
  };

  const guardarNuevoDesdeExistente = async () => {
    setGuardando(true); setError('');
    try {
      const evento = eventoAsistido ? parseInt(eventoAsistido, 10) : null;
      await api.post('/admin/participantes-excepcion', {
        participante_id: participanteExistente.id,
        nivel_completado: nivelCompletado,
        evento_asistido: evento,
        nota
      });
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const guardarNuevoDesdeCero = async (e) => {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      const evento = eventoAsistido ? parseInt(eventoAsistido, 10) : null;
      await api.post('/admin/participantes-excepcion', {
        ...form,
        tiempo_comparte_testimonio: form.comparte_testimonio === 'Si'
          ? `${form.tiempo_comparte_cantidad} ${form.tiempo_comparte_unidad}`
          : null,
        nivel_completado: nivelCompletado,
        evento_asistido: evento,
        nota
      });
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Registrar en Participantes Sin Requisitos</h2>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        {paso === 'dni' && (
          <form onSubmit={verificarDni} className="mt-5 space-y-4">
            <p className="text-sm text-ink/60">
              Primero verificamos si esta persona ya está en el sistema, para no duplicar sus datos.
            </p>
            <Campo label="Número de identidad (DNI)">
              <input required inputMode="numeric" className={claseInput} value={dniConsulta}
                onChange={e => setDniConsulta(e.target.value.replace(/[^\d]/g, ''))} placeholder="0801199912345" />
            </Campo>
            {errorDni && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember">{errorDni}</p>}
            <button disabled={verificando} className="w-full rounded-full bg-gold py-3 font-semibold text-night hover:bg-gold-light disabled:opacity-60">
              {verificando ? 'Verificando…' : 'Verificar DNI'}
            </button>
          </form>
        )}

        {paso === 'historial' && participanteExistente && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
              <p className="font-semibold text-ink">{participanteExistente.nombre_completo}</p>
              <p className="text-sm text-ink/60">DNI: {participanteExistente.dni} · Capítulo: {participanteExistente.capitulo || '—'}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink/70">Historial de niveles ya cursados</p>
              {inscripcionesExistente.length === 0 && <p className="text-sm text-ink/40">Sin inscripciones registradas todavía.</p>}
              <ul className="space-y-1">
                {inscripcionesExistente.map((i, idx) => (
                  <li key={idx} className="rounded-lg bg-parchment-2 px-3 py-2 text-sm text-ink/70">
                    Nivel {numeroARomano(i.orden)} — {i.fecha_graduacion ? `graduado (${new Date(i.fecha_graduacion).toLocaleDateString('es-HN', { timeZone: 'UTC' })})` : 'registrado, sin graduar'}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-ink/50">
              Si el historial confirma que en realidad sí cumple el requisito, ciérralo aquí e inscríbelo directo y normal desde Participantes.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nivel que ya tiene completado (0 si ninguno)">
                <select className={claseInput} value={nivelCompletado} onChange={e => setNivelCompletado(parseInt(e.target.value, 10))}>
                  <option value={0}>0 — Ninguno</option>
                  <option value={1}>1 — Nivel I</option>
                  <option value={2}>2 — Nivel II</option>
                  <option value={3}>3 — Nivel III</option>
                </select>
              </Campo>
              <Campo label="Evento al que asiste ahora sin diploma" requerido={false}>
                <select className={claseInput} value={eventoAsistido} onChange={e => setEventoAsistido(e.target.value)}>
                  <option value="">No aplica todavía</option>
                  <option value="2">Nivel II</option>
                  <option value="3">Nivel III</option>
                  <option value="4">Nivel IV</option>
                </select>
              </Campo>
            </div>
            <Campo label="Nota / observación" requerido={false}>
              <textarea rows={2} className={claseInput} value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" />
            </Campo>
            {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPaso('dni')} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Volver</button>
              <button onClick={guardarNuevoDesdeExistente} disabled={guardando}
                className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Registrar en Sin Requisitos'}
              </button>
            </div>
          </div>
        )}

        {paso === 'formulario' && (
          <form onSubmit={guardarNuevoDesdeCero} className="mt-5 space-y-5">
            <p className="text-sm text-ink/60">No existe en el sistema todavía — completa sus datos igual que en el registro normal del Evento 1.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo label="Nombre completo">
                  <input required className={claseInput} value={form.nombre_completo} onChange={set('nombre_completo')} />
                </Campo>
              </div>
              <Campo label="DNI">
                <input required disabled className="w-full rounded-lg border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-ink/60" value={form.dni} />
              </Campo>
              <Campo label="Celular">
                <input required className={claseInput} value={form.celular} onChange={set('celular')} />
              </Campo>
              <Campo label="Capítulo">
                <input required className={claseInput} value={form.capitulo} onChange={set('capitulo')} />
              </Campo>
              <Campo label="Zona">
                <select required className={claseInput} value={form.zona} onChange={set('zona')}>
                  <option value="">Selecciona…</option>
                  {ZONAS_FIHNEC.map(z => <option key={z}>{z}</option>)}
                </select>
              </Campo>
              <Campo label="Departamento">
                <select required className={claseInput} value={form.departamento} onChange={cambiarDepartamento}>
                  <option value="">Selecciona…</option>
                  {DEPARTAMENTOS_HONDURAS.map(d => <option key={d}>{d}</option>)}
                </select>
              </Campo>
              <Campo label="Municipio">
                <select required className={claseInput} value={form.municipio} onChange={set('municipio')} disabled={!form.departamento}>
                  <option value="">{form.departamento ? 'Selecciona…' : 'Primero elige un departamento'}</option>
                  {municipiosDisponibles.map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <div className="sm:col-span-2">
                <Campo label="Cargo en FIHNEC">
                  <select required className={claseInput} value={form.cargo_fihnec} onChange={set('cargo_fihnec')}>
                    <option value="">Selecciona…</option>
                    {CARGOS_FIHNEC.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo label="Estado civil">
                <select required className={claseInput} value={form.estado_civil} onChange={set('estado_civil')}>
                  <option value="">Selecciona…</option>
                  {['Soltero', 'Casado', 'Unión libre', 'Divorciado', 'Viudo'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Campo>
              <Campo label="Cantidad de hijos">
                <input required type="number" min="0" className={claseInput} value={form.hijos_cantidad} onChange={set('hijos_cantidad')} />
              </Campo>
              <Campo label="Contacto de emergencia">
                <input required className={claseInput} value={form.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')} />
              </Campo>
              <Campo label="Teléfono de emergencia">
                <input required className={claseInput} value={form.contacto_emergencia_telefono} onChange={set('contacto_emergencia_telefono')} />
              </Campo>
            </div>

            <div className="grid gap-4 border-t border-ink/10 pt-4 sm:grid-cols-2">
              <Campo label="Nivel que ya tiene completado (0 si ninguno)">
                <select className={claseInput} value={nivelCompletado} onChange={e => setNivelCompletado(parseInt(e.target.value, 10))}>
                  <option value={0}>0 — Ninguno</option>
                  <option value={1}>1 — Nivel I</option>
                  <option value={2}>2 — Nivel II</option>
                  <option value={3}>3 — Nivel III</option>
                </select>
              </Campo>
              <Campo label="Evento al que asiste ahora sin diploma" requerido={false}>
                <select className={claseInput} value={eventoAsistido} onChange={e => setEventoAsistido(e.target.value)}>
                  <option value="">No aplica todavía</option>
                  <option value="2">Nivel II</option>
                  <option value="3">Nivel III</option>
                  <option value="4">Nivel IV</option>
                </select>
              </Campo>
            </div>
            <Campo label="Nota / observación" requerido={false}>
              <textarea rows={2} className={claseInput} value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" />
            </Campo>

            {error && <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPaso('dni')} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Volver</button>
              <button disabled={guardando} className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Registrar en Sin Requisitos'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ModalEditar({ fila, onCerrar, onGuardado }) {
  const [nivelCompletado, setNivelCompletado] = useState(fila.nivel_completado);
  const [nota, setNota] = useState(fila.nota || '');
  const [evento, setEvento] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      await api.put(`/admin/participantes-excepcion/${fila.id}`, { nivel_completado: nivelCompletado, nota });
      if (evento) await api.post(`/admin/participantes-excepcion/${fila.id}/eventos`, { orden: parseInt(evento, 10) });
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const listoParaTrasladar = nivelCompletado >= 3;

  const trasladar = async () => {
    if (!confirm(`¿Confirmas que ${fila.nombre_completo} ya se puso al día y quieres trasladarlo a Participantes? Esto lo crea/actualiza en Participantes y lo quita de esta lista.`)) return;
    setGuardando(true); setError('');
    try {
      await api.post(`/admin/participantes-excepcion/${fila.id}/trasladar`);
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{fila.nombre_completo}</h2>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink/50">DNI: {fila.dni || '—'} · Capítulo: {fila.capitulo || '—'}</p>

        {listoParaTrasladar && (
          <div className="mt-4 rounded-xl border border-palm/30 bg-palm/10 p-4">
            <p className="text-sm font-semibold text-palm">✅ Ya completó lo que le faltaba (Nivel III o más).</p>
            <p className="mt-1 text-xs text-ink/60">Confirma con Carlos y traslada este registro a Participantes cuando esté listo.</p>
            <button onClick={trasladar} disabled={guardando} className="mt-3 rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
              {guardando ? 'Procesando…' : '→ Trasladar a Participantes'}
            </button>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink/70">Eventos asistidos sin diploma hasta ahora</p>
            {(fila.eventos_sin_diploma || []).length === 0 && <p className="text-sm text-ink/40">Ninguno todavía.</p>}
            <ul className="space-y-1">
              {(fila.eventos_sin_diploma || []).map((e, idx) => (
                <li key={idx} className="rounded-lg bg-parchment-2 px-3 py-1.5 text-sm text-ink/70">Nivel {numeroARomano(e.orden)} ({e.fecha})</li>
              ))}
            </ul>
          </div>
          <Campo label="Actualizar nivel completado (Carlos actualiza cada vez que se pone al corriente)">
            <select className={claseInput} value={nivelCompletado} onChange={e => setNivelCompletado(parseInt(e.target.value, 10))}>
              <option value={0}>0 — Ninguno</option>
              <option value={1}>1 — Nivel I</option>
              <option value={2}>2 — Nivel II</option>
              <option value={3}>3 — Nivel III</option>
            </select>
          </Campo>
          <Campo label="Agregar evento nuevo asistido sin diploma" requerido={false}>
            <select className={claseInput} value={evento} onChange={e => setEvento(e.target.value)}>
              <option value="">No agregar ninguno ahora</option>
              <option value="2">Nivel II</option>
              <option value="3">Nivel III</option>
              <option value="4">Nivel IV</option>
            </select>
          </Campo>
          <Campo label="Nota / observación" requerido={false}>
            <textarea rows={2} className={claseInput} value={nota} onChange={e => setNota(e.target.value)} />
          </Campo>
        </div>

        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCerrar} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Cerrar</button>
          <button onClick={guardar} disabled={guardando} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDiplomasSinRequisitos() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [mostrarRegistrar, setMostrarRegistrar] = useState(false);
  const [editando, setEditando] = useState(null);
  const [descargando, setDescargando] = useState('');

  const cargar = () => {
    setCargando(true);
    api.get('/admin/participantes-excepcion', { params: buscar ? { buscar } : {} })
      .then(r => setDatos(r.data.datos))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buscarAhora = (e) => { e.preventDefault(); cargar(); };

  const eliminar = async (fila) => {
    if (!confirm(`¿Eliminar el registro de ${fila.nombre_completo || fila.dni} de Participantes Sin Requisitos? (Se guarda en la papelera por si fue un error).`)) return;
    await api.delete(`/admin/participantes-excepcion/${fila.id}`);
    cargar();
  };

  const descargar = async (tipo) => {
    setDescargando(tipo);
    try {
      const resp = await fetch(`${api.defaults.baseURL}/admin/participantes-excepcion/${tipo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `sin_requisitos.${tipo === 'excel' ? 'xlsx' : 'pdf'}`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando('');
    }
  };

  return (
    <div>
      <Link to="/admin/diplomas" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 hover:text-ink">
        <span aria-hidden>←</span> Volver a Diplomas
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Participantes Sin Requisitos</h1>
          <p className="text-sm text-ink/50">Asisten a un evento sin cumplir el requisito normal — no reciben diploma hasta ponerse al día.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => descargar('excel')} disabled={descargando !== ''}
            className="rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
            {descargando === 'excel' ? 'Generando…' : '⬇ Excel (todos los campos)'}
          </button>
          <button onClick={() => descargar('pdf')} disabled={descargando !== ''}
            className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white hover:bg-ember-light disabled:opacity-60">
            {descargando === 'pdf' ? 'Generando…' : '⬇ PDF (todos los campos)'}
          </button>
          <button onClick={() => setMostrarRegistrar(true)} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-night hover:bg-gold-light">
            + Registrar
          </button>
        </div>
      </div>

      <form onSubmit={buscarAhora} className="mt-5 flex gap-2">
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o DNI"
          className="w-full max-w-sm rounded-lg border border-ink/15 px-3.5 py-2 text-sm" />
        <button className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:bg-ink/5">Buscar</button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Nombre Completo</th>
              <th className="px-4 py-3">DNI</th>
              <th className="px-4 py-3">Capítulo</th>
              <th className="px-4 py-3 text-center">Nivel Completado</th>
              <th className="px-4 py-3">Eventos Sin Diploma</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">Cargando…</td></tr>}
            {!cargando && datos.map(f => (
              <tr key={f.id} className="border-t border-ink/5">
                <td className="px-4 py-2.5 font-medium text-ink">
                  {f.nombre_completo}
                  {f.participante_id && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">enlazado</span>}
                </td>
                <td className="px-4 py-2.5 text-ink/60">{f.dni || '—'}</td>
                <td className="px-4 py-2.5 text-ink/60">{f.capitulo || '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={f.nivel_completado >= 3 ? 'font-semibold text-palm' : 'text-ink/60'}>
                    {f.nivel_completado} de 3
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink/60">
                  {(f.eventos_sin_diploma || []).map(e => `N${e.orden}`).join(', ') || '—'}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button onClick={() => setEditando(f)} className="text-gold hover:underline">Ver / editar</button>
                  <button onClick={() => eliminar(f)} className="ml-3 text-ember hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {!cargando && datos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40">No hay participantes registrados en esta lista.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {mostrarRegistrar && (
        <ModalRegistrar onCerrar={() => setMostrarRegistrar(false)} onGuardado={() => { setMostrarRegistrar(false); cargar(); }} />
      )}
      {editando && (
        <ModalEditar fila={editando} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />
      )}
    </div>
  );
}
