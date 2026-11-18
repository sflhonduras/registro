import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { mensajeError } from '../api';
import { useConfirmar } from '../components/ConfirmProvider';
import BotonVolver from '../components/BotonVolver';
import CampoBuscable from '../components/CampoBuscable';
import InfoEvento from '../components/InfoEvento';
import ProximasFechas from '../components/ProximasFechas';
import PromoWhatsApp from '../components/PromoWhatsApp';
import SelectorFecha from '../components/SelectorFecha';
import {
  Boton, BotonSecundario, Encabezado, BanderaHonduras, TarjetaMarca, Campo, CampoGrupo, claseInput,
} from '../components/FormularioMarca';
import {
  zonasDeDepartamento, zonaValidaPara, DEPARTAMENTOS_HONDURAS, MUNICIPIOS_POR_DEPARTAMENTO, CARGOS_FIHNEC,
} from '../listas';

const TOTAL_PASOS = 6;
const NOMBRES_PASOS = ['Identificación', 'Datos personales', 'Ubicación', 'Datos FIHNEC', 'Contacto de emergencia', 'Revisión'];
const ESTADOS_CIVILES = ['Soltero', 'Casado', 'Unión libre', 'Divorciado', 'Viudo'];

const VACIO = {
  nombre_completo: '', dni: '', fecha_nacimiento: '', celular: '', capitulo: '', zona: '', departamento: '', municipio: '',
  cargo_fihnec: '', estado_civil: '', hijos_cantidad: '', comparte_testimonio: '',
  tiempo_comparte_cantidad: '', tiempo_comparte_unidad: 'Meses',
  ha_recibido_sael: '', cantidad_saeles: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', observacion: ''
};

function separarTiempo(texto) {
  if (!texto) return { cantidad: '', unidad: 'Meses' };
  const m = String(texto).match(/(\d+)\s*(\S+)/);
  if (!m) return { cantidad: '', unidad: 'Meses' };
  const unidad = ['día', 'dia'].some(u => m[2].toLowerCase().startsWith(u)) ? 'Días'
    : m[2].toLowerCase().startsWith('año') ? 'Años' : 'Meses';
  return { cantidad: m[1], unidad };
}

function datosParaFormulario(p) {
  const t = separarTiempo(p.tiempo_comparte_testimonio);
  return {
    nombre_completo: p.nombre_completo || '', dni: p.dni || '', fecha_nacimiento: p.fecha_nacimiento || '', celular: p.celular || '',
    capitulo: p.capitulo || '', zona: p.zona || '', departamento: p.departamento || '', municipio: p.municipio || '',
    cargo_fihnec: p.cargo_fihnec || '', estado_civil: p.estado_civil || '',
    hijos_cantidad: p.hijos_cantidad ?? '', comparte_testimonio: p.comparte_testimonio || '',
    tiempo_comparte_cantidad: t.cantidad, tiempo_comparte_unidad: t.unidad,
    ha_recibido_sael: p.ha_recibido_sael || '', cantidad_saeles: p.cantidad_saeles ?? '',
    contacto_emergencia_nombre: p.contacto_emergencia_nombre || '', contacto_emergencia_telefono: p.contacto_emergencia_telefono || '',
    observacion: p.observacion || ''
  };
}

const claseDni = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-3 text-center font-display text-2xl tracking-widest text-ink transition focus:border-ember focus:outline-none focus:ring-4 focus:ring-ember/10';

export default function RegistroEvento1() {
  const confirmar = useConfirmar();
  const nav = useNavigate();
  // 'dni' (paso 1) | 'decision' (ya existe) | 'wizard' (pasos 2 a 6)
  const [vista, setVista] = useState('dni');
  const [paso, setPaso] = useState(1);
  const [esExtranjero, setEsExtranjero] = useState(false);
  const [dniConsulta, setDniConsulta] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [participanteExistente, setParticipanteExistente] = useState(null);
  const [actualizarDatos, setActualizarDatos] = useState(null); // true | false | null

  const [form, setForm] = useState(VACIO);
  const [evento, setEvento] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(null);
  const [pinAsignado, setPinAsignado] = useState(null);

  useEffect(() => {
    api.get('/eventos/1/estado').then(r => setEvento(r.data)).catch(() => {});
  }, []);

  const actualizar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
  const cambiarDepartamento = (valor) => setForm(f => ({ ...f, departamento: valor, municipio: '', zona: zonaValidaPara(valor, f.zona) }));
  const municipiosDisponibles = form.departamento ? (MUNICIPIOS_POR_DEPARTAMENTO[form.departamento] || []) : [];
  const cambiarTipo = (extranjero) => { setEsExtranjero(extranjero); setDniConsulta(''); setError(''); };

  const verificarDni = async () => {
    setError('');
    if (esExtranjero) {
      if (!/^[A-Za-z0-9]{5,20}$/.test(dniConsulta)) { setError('El número de pasaporte debe ser alfanumérico (5 a 20 caracteres).'); return; }
    } else if (!/^\d{13}$/.test(dniConsulta)) { setError('El DNI debe tener 13 dígitos.'); return; }
    setVerificando(true);
    try {
      const { data } = await api.get(`/evento1/verificar/${dniConsulta}`);
      if (!data.existe) {
        setForm({ ...VACIO, dni: dniConsulta });
        setActualizarDatos(null);
        setPaso(2); setVista('wizard');
      } else if (data.ya_registrado_ciclo_actual) {
        setError('Ya estás registrado en el Nivel I para el evento actual. No es necesario volver a inscribirte.');
      } else {
        setParticipanteExistente(data.participante);
        setVista('decision');
      }
    } catch {
      setError('No se pudo verificar tu identificación. Intenta de nuevo.');
    } finally {
      setVerificando(false);
    }
  };

  const elegirNoActualizar = async () => {
    if (!(await confirmar({ titulo: 'Confirmar inscripción', mensaje: '¿Confirmas tu inscripción con los datos que ya tenemos registrados?', textoConfirmar: 'Sí, inscribirme', textoCancelar: 'Revisar' }))) return;
    setActualizarDatos(false);
    setEnviando(true); setError('');
    try {
      const r = await api.post('/registro/evento1', { dni: participanteExistente.dni, actualizar_datos: false, ...(esExtranjero ? { es_extranjero: true } : {}) });
      setExito(r.data.mensaje);
      setPinAsignado(r.data.pin || null);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const elegirActualizar = () => {
    setActualizarDatos(true);
    setForm(datosParaFormulario(participanteExistente));
    setError('');
    setPaso(2); setVista('wizard');
  };

  const cancelarInscripcion = async () => {
    if (!(await confirmar({ titulo: 'Cancelar inscripción', mensaje: 'Si cancelas, los datos que escribiste no se guardarán y volverás al inicio. ¿Quieres cancelar tu inscripción?', textoConfirmar: 'Sí, cancelar', textoCancelar: 'Seguir inscribiéndome', peligro: true }))) return;
    nav('/');
  };

  // --- Validación por paso ---
  const celularOk = (v) => /^\d{8}$/.test(v);
  const validar = (n) => {
    if (n === 2) {
      if (!form.nombre_completo.trim() || !form.fecha_nacimiento || !form.estado_civil || form.hijos_cantidad === '') return 'Completa todos los campos, incluida la fecha de nacimiento.';
      if (!celularOk(form.celular)) return 'El número de celular debe tener exactamente 8 dígitos.';
    }
    if (n === 3) {
      if (!form.capitulo.trim() || !form.departamento || !form.municipio || !form.zona) return 'Completa todos los campos.';
    }
    if (n === 4) {
      if (!form.cargo_fihnec || !form.comparte_testimonio || !form.ha_recibido_sael) return 'Completa todos los campos.';
      if (form.comparte_testimonio === 'Si' && !String(form.tiempo_comparte_cantidad).trim()) return 'Indica hace cuánto tiempo compartes testimonio.';
      if (form.ha_recibido_sael === 'Si' && !String(form.cantidad_saeles).trim()) return 'Indica cuántos SAELES has recibido.';
    }
    if (n === 5) {
      if (!form.contacto_emergencia_nombre.trim() || !celularOk(form.contacto_emergencia_telefono)) return 'Completa el contacto de emergencia. El teléfono debe tener exactamente 8 dígitos.';
    }
    return null;
  };
  const siguiente = () => {
    const msg = validar(paso);
    if (msg) { setError(msg); return; }
    setError(''); setPaso(p => p + 1);
  };
  const atras = () => {
    setError('');
    if (paso === 2) {
      if (actualizarDatos === true) setVista('decision'); else setVista('dni');
      return;
    }
    setPaso(p => p - 1);
  };

  const enviar = async () => {
    setError('');
    if (!(await confirmar({ titulo: 'Enviar inscripción', mensaje: '¿Confirmas que tus datos están correctos y quieres enviar tu inscripción?', textoConfirmar: 'Sí, enviar', textoCancelar: 'Revisar' }))) return;
    setEnviando(true);
    try {
      const payload = {
        ...form,
        ...(esExtranjero ? { es_extranjero: true } : {}),
        tiempo_comparte_testimonio: form.comparte_testimonio === 'Si'
          ? `${form.tiempo_comparte_cantidad} ${form.tiempo_comparte_unidad}`
          : null,
        ...(actualizarDatos !== null ? { actualizar_datos: actualizarDatos } : {})
      };
      const r = await api.post('/registro/evento1', payload);
      setExito(r.data.mensaje);
      setPinAsignado(r.data.pin || null);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  // --- Pantallas especiales ---

  if (exito) {
    return (
      <div className="min-h-[70vh] bg-parchment px-5 py-14">
        <div className="mx-auto max-w-md">
          <TarjetaMarca className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#007334]/10">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#007334" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">{exito}</h1>
            <p className="mt-3 text-ink/60">Guarda tu número de identificación: lo necesitarás para inscribirte a los siguientes niveles.</p>

            {pinAsignado && (
              <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-gold">Tu PIN personal</p>
                <p className="mt-2 font-display text-4xl font-bold tracking-[0.3em] text-ink">{pinAsignado}</p>
                <p className="mt-3 text-sm text-ink/60">
                  Junto con tu número de identificación, vas a necesitar este PIN más adelante para consultar tu información,
                  tu código QR de asistencia y tus niveles en el portal de autoconsulta. Guárdalo en un lugar seguro —
                  lo puedes cambiar cuando quieras desde ahí mismo.
                </p>
              </div>
            )}

            {evento && <div className="mt-4"><InfoEvento evento={evento} /></div>}
            <PromoWhatsApp />
            <Boton onClick={() => nav('/')} variant="blue" className="mt-8">Volver al inicio</Boton>
          </TarjetaMarca>
        </div>
      </div>
    );
  }

  if (evento && !evento.abierto) {
    return (
      <div className="min-h-[60vh] bg-parchment px-5 py-14">
        <div className="mx-auto max-w-md">
          <BotonVolver />
          <TarjetaMarca className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">Registro cerrado</h1>
            <p className="mt-2 text-ink/50">El registro para el SFL Nivel I no está disponible en este momento.</p>
          </TarjetaMarca>
        </div>
      </div>
    );
  }

  if (vista === 'decision' && participanteExistente) {
    return (
      <div className="min-h-[60vh] bg-parchment px-5 py-14">
        <div className="mx-auto max-w-md">
          <Encabezado etiqueta="SFL Nivel I · Inscripción" />
          <TarjetaMarca className="text-center">
            <p className="text-sm text-ink/50">Ya tenemos tus datos registrados</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">{participanteExistente.nombre_completo}</h1>
            <p className="mt-4 text-sm text-ink/60">¿Confirmamos tu inscripción al <strong>Nivel I</strong>?</p>
            {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            <div className="mt-6 flex flex-col gap-3">
              <Boton onClick={elegirNoActualizar} disabled={enviando} variant="green" className="w-full">
                {enviando ? 'Confirmando…' : 'Confirmar inscripción'}
              </Boton>
              <BotonSecundario onClick={elegirActualizar} className="w-full">Actualizar información</BotonSecundario>
              <button
                onClick={() => { setParticipanteExistente(null); setVista('dni'); setDniConsulta(''); setError(''); }}
                className="text-sm font-semibold text-ink/50 transition hover:text-ember"
              >
                Cancelar e ingresar otro número de identificación
              </button>
            </div>
          </TarjetaMarca>
        </div>
      </div>
    );
  }

  // --- Asistente de pasos ---
  const pasoActual = vista === 'dni' ? 1 : paso;
  const etiquetaEncabezado = actualizarDatos ? 'Actualiza tus datos · SFL Nivel I' : 'Inscripción · SFL Nivel I';

  return (
    <div className="min-h-[70vh] bg-parchment px-5 py-14">
      <div className="mx-auto max-w-xl">
        <BotonVolver />
        <Encabezado etiqueta={etiquetaEncabezado} />

        {pasoActual === 1 && evento && <div className="mb-4 text-center"><InfoEvento evento={evento} /></div>}

        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink/40">
          <span>Paso {pasoActual} de {TOTAL_PASOS}</span>
          <span>{NOMBRES_PASOS[pasoActual - 1]}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-ember transition-all duration-300" style={{ width: `${(pasoActual / TOTAL_PASOS) * 100}%` }} />
        </div>

        <TarjetaMarca className="mt-8">
          {error && <p className="mb-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

          {vista === 'dni' && (
            <div className="space-y-4 text-center">
              <h2 className="font-display text-xl font-bold text-ink">
                {esExtranjero ? 'Empecemos con tu pasaporte' : 'Empecemos con tu DNI'}
              </h2>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => cambiarTipo(false)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${!esExtranjero ? 'bg-night text-white' : 'border border-ink/20 text-ink/60 hover:bg-ink/5'}`}>
                  <BanderaHonduras /> Hondureño
                </button>
                <button type="button" onClick={() => cambiarTipo(true)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${esExtranjero ? 'bg-night text-white' : 'border border-ink/20 text-ink/60 hover:bg-ink/5'}`}>
                  🌎 Extranjero
                </button>
              </div>
              <label className="block">
                {esExtranjero ? (
                  <input type="text" maxLength={20} value={dniConsulta}
                    onChange={e => setDniConsulta(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter' && dniConsulta.length >= 5 && !verificando) verificarDni(); }}
                    className={claseDni} placeholder="Número de pasaporte" />
                ) : (
                  <input type="text" inputMode="numeric" maxLength={13} value={dniConsulta}
                    onChange={e => setDniConsulta(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter' && dniConsulta.length === 13 && !verificando) verificarDni(); }}
                    className={claseDni} placeholder="0801199012345" />
                )}
                <span className="mt-2 block text-center text-base font-semibold text-ink/50">
                  {esExtranjero ? `${dniConsulta.length} caracteres` : `${dniConsulta.length}/13 dígitos`}
                </span>
              </label>
              <div className="flex justify-center pt-2">
                <Boton onClick={verificarDni} disabled={verificando}>{verificando ? 'Verificando…' : 'Continuar'}</Boton>
              </div>
            </div>
          )}

          {vista === 'wizard' && paso === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-ink">Tus datos personales</h2>
              <Campo etiqueta={esExtranjero ? 'Número de pasaporte' : 'Número de identidad (DNI)'}>
                <input disabled className={`${claseInput} cursor-not-allowed bg-ink/5 text-ink/40`} value={form.dni} />
              </Campo>
              <Campo etiqueta="Nombre completo">
                <input type="text" value={form.nombre_completo} onChange={e => actualizar('nombre_completo', e.target.value)} className={claseInput} placeholder="Ej. Juan Carlos Pérez López" />
              </Campo>
              <CampoGrupo etiqueta="Fecha de nacimiento">
                <SelectorFecha value={form.fecha_nacimiento} onChange={v => actualizar('fecha_nacimiento', v)} className={claseInput} />
              </CampoGrupo>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <Campo etiqueta="Celular (8 dígitos)">
                  <input type="tel" inputMode="numeric" maxLength={8} value={form.celular}
                    onChange={e => actualizar('celular', e.target.value.replace(/\D/g, ''))} className={claseInput} placeholder="99999999" />
                  <span className="mt-1 block text-xs text-ink/40">{form.celular.length}/8 dígitos</span>
                </Campo>
                <Campo etiqueta="Estado civil">
                  <select value={form.estado_civil} onChange={e => actualizar('estado_civil', e.target.value)} className={claseInput}>
                    <option value="">Selecciona…</option>
                    {ESTADOS_CIVILES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo etiqueta="Cantidad de hijos">
                <div className="w-28">
                  <input type="number" min="0" max="30" value={form.hijos_cantidad} onChange={e => actualizar('hijos_cantidad', e.target.value)} className={claseInput} />
                </div>
              </Campo>
              <Navegacion atras={atras} siguiente={siguiente} />
            </div>
          )}

          {vista === 'wizard' && paso === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-ink">Ubicación</h2>
              <Campo etiqueta="Capítulo al que perteneces">
                <CampoBuscable id="capitulo" opciones={[]} required value={form.capitulo} onChange={e => actualizar('capitulo', e.target.value)} placeholder="Escribe el nombre de tu capítulo" />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <Campo etiqueta="Departamento">
                  <select value={form.departamento} onChange={e => cambiarDepartamento(e.target.value)} className={claseInput}>
                    <option value="">Selecciona…</option>
                    {DEPARTAMENTOS_HONDURAS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Municipio">
                  <select value={form.municipio} onChange={e => actualizar('municipio', e.target.value)} disabled={!form.departamento} className={`${claseInput} disabled:bg-ink/5`}>
                    <option value="">{form.departamento ? 'Selecciona…' : 'Primero elige un departamento'}</option>
                    {municipiosDisponibles.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo etiqueta="Zona">
                <select value={form.zona} onChange={e => actualizar('zona', e.target.value)} disabled={!form.departamento} className={`${claseInput} disabled:bg-ink/5`}>
                  <option value="">{form.departamento ? 'Selecciona…' : 'Primero elige un departamento'}</option>
                  {zonasDeDepartamento(form.departamento, form.zona).map(z => <option key={z}>{z}</option>)}
                </select>
              </Campo>
              <Navegacion atras={atras} siguiente={siguiente} />
            </div>
          )}

          {vista === 'wizard' && paso === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-ink">Datos FIHNEC</h2>
              <Campo etiqueta="Cargo en FIHNEC">
                <select value={form.cargo_fihnec} onChange={e => actualizar('cargo_fihnec', e.target.value)} className={claseInput}>
                  <option value="">Selecciona…</option>
                  {CARGOS_FIHNEC.map(c => <option key={c}>{c}</option>)}
                </select>
              </Campo>

              <CampoGrupo etiqueta="¿Compartes testimonio?">
                <div className="flex gap-3">
                  <BotonSecundario onClick={() => actualizar('comparte_testimonio', 'Si')} className={form.comparte_testimonio === 'Si' ? '!border-ember !text-ember' : ''}>Sí</BotonSecundario>
                  <BotonSecundario onClick={() => setForm(f => ({ ...f, comparte_testimonio: 'No', tiempo_comparte_cantidad: '' }))} className={form.comparte_testimonio === 'No' ? '!border-ember !text-ember' : ''}>No</BotonSecundario>
                </div>
              </CampoGrupo>
              {form.comparte_testimonio === 'Si' && (
                <CampoGrupo etiqueta="¿Hace cuánto tiempo?">
                  <div className="flex gap-2">
                    <input type="number" min="1" max="999" value={form.tiempo_comparte_cantidad}
                      onChange={e => actualizar('tiempo_comparte_cantidad', e.target.value)} className={claseInput} placeholder="Ej. 6" />
                    <select value={form.tiempo_comparte_unidad} onChange={e => actualizar('tiempo_comparte_unidad', e.target.value)} className={claseInput}>
                      <option>Días</option><option>Meses</option><option>Años</option>
                    </select>
                  </div>
                </CampoGrupo>
              )}

              <CampoGrupo etiqueta="¿Has recibido SAEL anteriormente?">
                <div className="flex gap-3">
                  <BotonSecundario onClick={() => actualizar('ha_recibido_sael', 'Si')} className={form.ha_recibido_sael === 'Si' ? '!border-ember !text-ember' : ''}>Sí</BotonSecundario>
                  <BotonSecundario onClick={() => setForm(f => ({ ...f, ha_recibido_sael: 'No', cantidad_saeles: '' }))} className={form.ha_recibido_sael === 'No' ? '!border-ember !text-ember' : ''}>No</BotonSecundario>
                </div>
              </CampoGrupo>
              {form.ha_recibido_sael === 'Si' && (
                <Campo etiqueta="¿Cuántos SAELES has recibido?">
                  <div className="w-28">
                    <input type="number" min="1" max="50" value={form.cantidad_saeles} onChange={e => actualizar('cantidad_saeles', e.target.value)} className={claseInput} />
                  </div>
                </Campo>
              )}
              <Navegacion atras={atras} siguiente={siguiente} />
            </div>
          )}

          {vista === 'wizard' && paso === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-ink">Contacto de emergencia</h2>
              <div className="grid gap-4 sm:grid-cols-[3fr_2fr] [&>*]:min-w-0">
                <Campo etiqueta="Nombre completo">
                  <input type="text" value={form.contacto_emergencia_nombre} onChange={e => actualizar('contacto_emergencia_nombre', e.target.value)} className={claseInput} />
                </Campo>
                <Campo etiqueta="Teléfono (8 dígitos)">
                  <input type="tel" inputMode="numeric" maxLength={8} value={form.contacto_emergencia_telefono}
                    onChange={e => actualizar('contacto_emergencia_telefono', e.target.value.replace(/\D/g, ''))} className={claseInput} placeholder="99999999" />
                  <span className="mt-1 block text-xs text-ink/40">{form.contacto_emergencia_telefono.length}/8 dígitos</span>
                </Campo>
              </div>
              <Campo etiqueta="Observaciones (opcional)">
                <textarea rows={3} value={form.observacion} onChange={e => actualizar('observacion', e.target.value)} className={claseInput} placeholder="Opcional" />
              </Campo>
              <Navegacion atras={atras} siguiente={siguiente} />
            </div>
          )}

          {vista === 'wizard' && paso === 6 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-ink">Revisa tus datos</h2>
              <dl className="divide-y divide-ink/10 text-sm">
                {[
                  [esExtranjero ? 'Pasaporte' : 'DNI', form.dni],
                  ['Nombre', form.nombre_completo],
                  ['Fecha de nacimiento', form.fecha_nacimiento ? form.fecha_nacimiento.slice(0, 10).split('-').reverse().join('/') : '—'],
                  ['Celular', form.celular],
                  ['Estado civil', form.estado_civil],
                  ['Hijos', String(form.hijos_cantidad)],
                  ['Capítulo', form.capitulo || '—'],
                  ['Departamento / Municipio', `${form.departamento} / ${form.municipio}`],
                  ['Zona', form.zona],
                  ['Cargo en FIHNEC', form.cargo_fihnec],
                  ['¿Comparte testimonio?', form.comparte_testimonio === 'Si' ? `Sí (${form.tiempo_comparte_cantidad} ${form.tiempo_comparte_unidad})` : 'No'],
                  ['¿Ha recibido SAEL?', form.ha_recibido_sael === 'Si' ? `Sí (${form.cantidad_saeles})` : 'No'],
                  ['Contacto de emergencia', `${form.contacto_emergencia_nombre} · ${form.contacto_emergencia_telefono}`],
                  ...(form.observacion ? [['Observaciones', form.observacion]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink/50">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex justify-between pt-2">
                <BotonSecundario onClick={atras}>Atrás</BotonSecundario>
                <Boton onClick={enviar} disabled={enviando} variant="green">
                  {enviando ? 'Enviando…' : actualizarDatos ? 'Guardar y confirmar inscripción' : 'Confirmar inscripción'}
                </Boton>
              </div>
            </div>
          )}
        </TarjetaMarca>

        {vista === 'wizard' && (
          <div className="mt-4 text-center">
            <button type="button" disabled={enviando} onClick={cancelarInscripcion}
              className="text-sm font-semibold text-ink/50 transition hover:text-ember disabled:opacity-50">
              Cancelar inscripción
            </button>
          </div>
        )}

        {vista === 'dni' && <ProximasFechas />}
      </div>
    </div>
  );
}

function Navegacion({ atras, siguiente }) {
  return (
    <div className="flex justify-between pt-2">
      <BotonSecundario onClick={atras}>Atrás</BotonSecundario>
      <Boton onClick={siguiente}>Continuar</Boton>
    </div>
  );
}
