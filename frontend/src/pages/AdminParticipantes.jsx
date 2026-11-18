import { useEffect, useState, useCallback, useRef } from 'react';
import api, { mensajeError } from '../api';
import PanelCumpleaneros from '../components/PanelCumpleaneros';
import SelectorFecha from '../components/SelectorFecha';
import ModalParticipanteEspecial from '../components/ModalParticipanteEspecial';
import { useConfirmar, CONFIRM_GUARDAR, CONFIRM_CANCELAR } from '../components/ConfirmProvider';
import { DEPARTAMENTOS_HONDURAS, MUNICIPIOS_POR_DEPARTAMENTO, zonasDeDepartamento, zonaValidaPara, procedenciaDe } from '../listas';

const CAMPOS = [
  ['nombre_completo', 'Nombre completo'], ['dni', 'DNI'], ['fecha_nacimiento', 'Fecha de nacimiento'], ['celular', 'Celular'],
  ['capitulo', 'Capítulo'], ['departamento', 'Departamento'], ['municipio', 'Municipio'], ['zona', 'Zona'],
  ['cargo_fihnec', 'Cargo en FIHNEC'], ['estado_civil', 'Estado civil'], ['hijos_cantidad', 'Hijos'],
  ['observacion', 'Observación']
];

const COLORES_TAB = {
  celeste: { on: 'bg-night-2 text-white border border-night-2', off: 'border border-night-2/40 bg-night-2/10 text-night-2 hover:bg-night-2/20' },
  azul: { on: 'bg-night text-white border border-night', off: 'border border-night/40 bg-night/10 text-night hover:bg-night/20' },
  oro: { on: 'bg-gold text-night border border-gold', off: 'border border-gold bg-gold/25 text-night hover:bg-gold/45' },
};
function claseTab(activa, color = 'azul') {
  return `rounded-full px-4 py-2 text-sm font-semibold transition ${COLORES_TAB[color][activa ? 'on' : 'off']}`;
}
// Botones de acción en filas de tabla: editar/ver = verde o neutro, eliminar = rojo.
const btnVer = 'rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5';
const btnEditar = 'rounded-full bg-[#007334] px-3 py-1 text-xs font-semibold text-white hover:bg-[#005c29]';
const btnEliminar = 'rounded-full bg-ember px-3 py-1 text-xs font-semibold text-white hover:bg-ember-light';
const btnVerde = 'rounded-full bg-[#007334] px-5 py-2 text-sm font-semibold text-white hover:bg-[#005c29]';
const claseFiltro = 'rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm';

// Muestra siempre el tipo y el número: "DNI: …", "Pasaporte: …" o "Código interno: …".
function textoIdentificacion(tipo, numero) {
  return tipo ? `${tipo}: ${numero}` : numero;
}

function ModalEditar({ participante, onCerrar, onGuardado, soloLectura }) {
  const confirmar = useConfirmar();
  const [form, setForm] = useState(participante);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardandoGraduacion, setGuardandoGraduacion] = useState(null);

  const usuarioActual = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const puedeVerPin = usuarioActual && ['admin', 'super_admin'].includes(usuarioActual.rol);
  const [pinVisible, setPinVisible] = useState(null);
  const [cargandoPin, setCargandoPin] = useState(false);
  const [regenerandoPin, setRegenerandoPin] = useState(false);
  useEffect(() => {
    if (participante.id && puedeVerPin) {
      setCargandoPin(true);
      api.get(`/admin/participantes/${participante.id}/pin`).then(({ data }) => setPinVisible(data.pin)).finally(() => setCargandoPin(false));
    }
  }, [participante.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerarPinParticipante = async () => {
    if (!(await confirmar({ titulo: 'Generar PIN nuevo', mensaje: '¿Generar un PIN nuevo? El anterior dejará de funcionar de inmediato, y se le pedirá que lo personalice en su próximo ingreso.', textoConfirmar: 'Sí, generar', peligro: true }))) return;
    setRegenerandoPin(true);
    try {
      const { data } = await api.post(`/admin/participantes/${participante.id}/regenerar-pin`);
      setPinVisible(data.pin);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setRegenerandoPin(false);
    }
  };

  const guardar = async () => {
    if (!(await confirmar(CONFIRM_GUARDAR))) return;
    setGuardando(true); setError('');
    try {
      await api.put(`/admin/participantes/${participante.id}`, form);
      onGuardado();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  const toggleInscripcion = async (orden, inscrito) => {
    if (!(await confirmar({
      titulo: inscrito ? 'Quitar nivel' : 'Agregar nivel',
      mensaje: inscrito ? `¿Quitar la inscripción al Nivel ${orden} de este participante?` : `¿Inscribir a este participante al Nivel ${orden}?`,
      textoConfirmar: inscrito ? 'Sí, quitar' : 'Sí, inscribir', peligro: inscrito,
    }))) return;
    try {
      if (inscrito) await api.delete(`/admin/participantes/${participante.id}/inscripciones/${orden}`);
      else await api.post(`/admin/participantes/${participante.id}/inscripciones/${orden}`);
      onGuardado(false);
      setForm(f => ({
        ...f,
        eventos_inscritos: inscrito ? f.eventos_inscritos.filter(o => o !== orden) : [...(f.eventos_inscritos || []), orden]
      }));
    } catch (err) { setError(mensajeError(err)); }
  };

  const guardarGraduacion = async (orden, fecha, promocion, ciclo) => {
    setGuardandoGraduacion(orden);
    try {
      await api.put(`/admin/participantes/${participante.id}/inscripciones/${orden}/graduacion`, {
        fecha_graduacion: fecha || null, promocion_graduacion: promocion || null, ciclo: ciclo || null
      });
      setForm(f => ({
        ...f,
        inscripciones: f.inscripciones.map(i => i.orden === orden ? { ...i, fecha_graduacion: fecha || null, promocion_graduacion: promocion || null, ciclo: ciclo ? parseInt(ciclo, 10) : i.ciclo } : i)
      }));
    } catch (err) { setError(mensajeError(err)); } finally { setGuardandoGraduacion(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{soloLectura ? 'Detalle del participante' : 'Editar participante'}</h2>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        {puedeVerPin && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">PIN de Autoconsulta</p>
              <p className="mt-0.5 font-display text-lg font-bold tracking-[0.3em] text-ink">
                {cargandoPin ? '····' : (pinVisible || '----')}
              </p>
              <p className="text-[11px] text-ink/40">Se lo mostró el sistema al inscribirse por primera vez — aquí solo lo ves tú.</p>
            </div>
            {!soloLectura && (
              <button type="button" onClick={regenerarPinParticipante} disabled={regenerandoPin}
                className="shrink-0 rounded-full border border-gold/40 px-4 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-50">
                {regenerandoPin ? 'Generando…' : '↻ Regenerar'}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CAMPOS.map(([campo, etiqueta]) => {
            // Zona / Departamento / Municipio son listas enlazadas: al elegir el Departamento,
            // Zona y Municipio muestran solo lo que le corresponde. Si el dato guardado no está
            // en la lista (datos históricos), se conserva como opción para no perderlo.
            const conActual = (lista, actual) => (actual && !lista.includes(actual) ? [...lista, actual] : lista);
            let opciones = null;
            if (campo === 'zona') opciones = zonasDeDepartamento(form.departamento, form.zona);
            if (campo === 'departamento') opciones = conActual(DEPARTAMENTOS_HONDURAS, form.departamento);
            if (campo === 'municipio') opciones = conActual(MUNICIPIOS_POR_DEPARTAMENTO[form.departamento] || [], form.municipio);
            const cambiar = (valor) => setForm(f => (
              campo === 'departamento'
                ? { ...f, departamento: valor, municipio: '', zona: zonaValidaPara(valor, f.zona) }
                : { ...f, [campo]: valor }
            ));
            if (campo === 'fecha_nacimiento') {
              return (
                <div key={campo} className="block text-sm">
                  <span className="mb-1 block text-ink/60">{etiqueta}</span>
                  {soloLectura
                    ? <p className="rounded-lg border border-ink/15 bg-ink/5 px-3 py-2">{form.fecha_nacimiento ? form.fecha_nacimiento.slice(0, 10).split('-').reverse().join('/') : '—'}</p>
                    : <SelectorFecha value={(form.fecha_nacimiento || '').slice(0, 10)} onChange={v => setForm(f => ({ ...f, fecha_nacimiento: v }))} />}
                </div>
              );
            }
            return (
              <label key={campo} className="block text-sm">
                <span className="mb-1 block text-ink/60">{etiqueta}</span>
                {opciones ? (
                  <select
                    disabled={soloLectura || ((campo === 'municipio' || campo === 'zona') && !form.departamento)}
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 disabled:bg-ink/5"
                    value={form[campo] ?? ''}
                    onChange={e => cambiar(e.target.value)}
                  >
                    <option value="">{(campo === 'municipio' || campo === 'zona') && !form.departamento ? 'Primero elige un departamento' : '— Seleccionar —'}</option>
                    {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    disabled={soloLectura}
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 disabled:bg-ink/5"
                    value={form[campo] ?? ''}
                    onChange={e => cambiar(e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>

        <label className={`mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          form.fallecido ? 'border-ink/20 bg-ink/5 text-ink/70' : 'border-ink/10 text-ink/50'
        }`}>
          <input
            type="checkbox"
            disabled={soloLectura}
            checked={!!form.fallecido}
            onChange={e => setForm(f => ({ ...f, fallecido: e.target.checked }))}
            className="h-4 w-4 accent-ink/60"
          />
          ✝ Q.E.P.D. — marcar si este participante falleció
        </label>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink/70">Niveles inscritos</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map(orden => {
              const inscrito = (form.eventos_inscritos || []).includes(orden);
              return (
                <button
                  key={orden}
                  disabled={soloLectura}
                  onClick={() => toggleInscripcion(orden, inscrito)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    inscrito ? 'bg-palm/15 text-palm' : 'bg-ink/5 text-ink/40'
                  } ${!soloLectura && 'hover:opacity-80'}`}
                >
                  Nivel {orden} {inscrito ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {form.inscripciones && form.inscripciones.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-ink/70">Fechas de registro y graduación</p>
            <div className="space-y-2">
              {form.inscripciones.map(insc => {
                const refFecha = { current: insc.fecha_graduacion ? insc.fecha_graduacion.slice(0, 10) : '' };
                const refPromocion = { current: insc.promocion_graduacion || '' };
                const refCiclo = { current: insc.ciclo ?? '' };
                const cicloDesfasado = insc.ciclo !== insc.ciclo_actual;
                return (
                <div key={insc.orden} className="flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 font-semibold text-ink">Nivel {insc.orden}</span>
                  <span className="text-ink/50">
                    Registrado: {new Date(insc.registrado_en).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-3 text-ink/60">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      Ciclo:
                      <input
                        type="number"
                        disabled={soloLectura}
                        defaultValue={refCiclo.current}
                        title={`El ciclo en vivo de este nivel va en el #${insc.ciclo_actual}. Si esta persona es de una promoción histórica (Excel), ponle un número que no coincida (ej. 0) para que no se mezcle con el grupo activo.`}
                        onChange={e => { refCiclo.current = e.target.value; }}
                        className="w-16 rounded-lg border border-ink/15 px-2 py-1 text-sm disabled:bg-ink/5"
                      />
                      <span className={`text-xs ${cicloDesfasado ? 'text-gold' : 'text-ink/30'}`}>
                        (en vivo: #{insc.ciclo_actual}{cicloDesfasado ? ' · histórico' : ' · activo'})
                      </span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      Graduación:
                      <input
                        type="date"
                        disabled={soloLectura}
                        defaultValue={refFecha.current}
                        onChange={e => { refFecha.current = e.target.value; }}
                        className="rounded-lg border border-ink/15 px-2 py-1 text-sm disabled:bg-ink/5"
                      />
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      Promoción:
                      <input
                        type="text"
                        disabled={soloLectura}
                        defaultValue={refPromocion.current}
                        placeholder="Ej. 5"
                        onChange={e => { refPromocion.current = e.target.value; }}
                        className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm disabled:bg-ink/5"
                      />
                    </span>
                    {!soloLectura && (
                      <button type="button" disabled={guardandoGraduacion === insc.orden}
                        onClick={async () => {
                          if (!(await confirmar({ titulo: 'Guardar graduación', mensaje: `¿Guardar el ciclo, la fecha de graduación y la promoción del Nivel ${insc.orden}?`, textoConfirmar: 'Sí, guardar', textoCancelar: 'Revisar' }))) return;
                          guardarGraduacion(insc.orden, refFecha.current, refPromocion.current, refCiclo.current);
                        }}
                        className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night hover:bg-gold-light disabled:opacity-60">
                        Guardar graduación
                      </button>
                    )}
                    {guardandoGraduacion === insc.orden && <span className="text-xs text-gold">Guardando…</span>}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {form.historial && form.historial.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink/70">
              📜 Historial archivado <span className="font-normal text-ink/40">(copias guardadas automáticamente antes de reinscripciones o eliminaciones)</span>
            </p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-ink/10 bg-ink/5 p-3">
              {form.historial.map((h, i) => (
                <p key={i} className="text-xs text-ink/60">
                  <span className="font-semibold text-ink/70">Nivel {h.orden}</span> · ciclo {h.ciclo ?? '—'} ·
                  {' '}graduación {h.fecha_graduacion ? h.fecha_graduacion.slice(0, 10) : '—'} ·
                  {' '}promoción {h.promocion_graduacion || '—'} ·
                  {' '}<span className="italic">
                    {h.motivo === 'reactivado' ? 'reemplazado al reinscribirse' : h.motivo === 'eliminado' ? 'eliminado por un admin' : 'editado a mano'}
                  </span>
                  {' '}el {new Date(h.archivado_en).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                </p>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

        {!soloLectura && (
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={async () => { if (await confirmar(CONFIRM_CANCELAR)) onCerrar(); }} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-night hover:bg-gold-light">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// PanelExportarContacto se mudó a Reportería — ver AdminReportes.jsx

// Abre la cámara del celular (directo en el navegador, sin instalar nada aparte) y lee un
// código QR. Cuando detecta uno, solo avisa cuál DNI encontró — NO marca "Registrado"
// automáticamente, para que un escaneo accidental o duplicado no desmarque a nadie por error.
// El equipo confirma con un clic, igual que si lo hubiera buscado a mano.
function ModalEscanearQR({ onCerrar, onDetectado }) {
  const regionId = 'lector-qr-participantes';
  const scannerRef = useRef(null);
  const detenidoRef = useRef(false);
  const [error, setError] = useState('');

  // Evita el error de detener la cámara dos veces (una vez al detectar el código, otra al
  // cerrarse el modal) — eso era lo que estaba tumbando toda la pantalla.
  const detenerCamara = async () => {
    if (detenidoRef.current || !scannerRef.current) return;
    detenidoRef.current = true;
    try { await scannerRef.current.stop(); } catch { /* puede que ya estuviera detenida */ }
    try { scannerRef.current.clear(); } catch { /* nada que limpiar */ }
  };

  useEffect(() => {
    let cancelado = false;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelado) return;
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (textoDecodificado) => {
          await detenerCamara();
          onDetectado(textoDecodificado);
        },
        () => {} // se dispara en cada frame sin QR detectado — no es un error real, se ignora
      ).catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.'));
    });
    return () => {
      cancelado = true;
      detenerCamara();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-ink">Escanear QR</p>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-ink/50">Apunta la cámara al código QR del participante.</p>
        {error && <p className="mt-3 rounded-lg bg-ember/10 p-2 text-xs text-ember">{error}</p>}
        <div id={regionId} className="mt-4 overflow-hidden rounded-xl" />
      </div>
    </div>
  );
}

export default function AdminParticipantes() {
  const confirmar = useConfirmar();
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const [nivelParticipantes, setNivelParticipantes] = useState(usuario?.rol === 'super_admin' ? 'edicion' : null);
  const [puedeMarcarPresencial, setPuedeMarcarPresencial] = useState(usuario?.rol === 'super_admin');
  const soloLectura = nivelParticipantes !== 'edicion';
  const [nuevoEspecial, setNuevoEspecial] = useState(null); // 'menor' | 'extranjero' | null
  const [toast, setToast] = useState(null); // { texto, tipo: 'registrado' | 'desmarcado' }

  const mostrarToast = (texto, tipo) => {
    setToast({ texto, tipo });
    setTimeout(() => setToast(t => (t?.texto === texto ? null : t)), 2500);
  };

  useEffect(() => {
    if (usuario?.rol === 'super_admin' || usuario?.rol === 'cocina') return;
    api.get('/admin/mis-permisos').then(r => {
      const permisoParticipantes = r.data.find(p => p.modulo === 'participantes');
      const permisoPresencial = r.data.find(p => p.modulo === 'participantes_presencial');
      setNivelParticipantes(permisoParticipantes ? permisoParticipantes.nivel : 'consulta');
      setPuedeMarcarPresencial(permisoParticipantes?.nivel === 'edicion' || permisoPresencial?.nivel === 'edicion');
    }).catch(() => setNivelParticipantes('consulta'));
  }, []);

  const [pestana, setPestana] = useState('actual'); // 'actual' | 'todos'
  const [eventoActual, setEventoActual] = useState(null);

  const [buscar, setBuscar] = useState('');
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
  const [avisoEscaneo, setAvisoEscaneo] = useState('');

  // El QR codifica "SFL-DNI:12345678901234" — se extrae el DNI y se usa la misma búsqueda
  // de siempre, para que el equipo vea al participante y confirme con un clic.
  const procesarEscaneo = (textoDetectado) => {
    setMostrarEscaner(false);
    const dniDetectado = String(textoDetectado || '').replace('SFL-DNI:', '').trim();
    if (!dniDetectado) {
      setAvisoEscaneo('No se pudo leer ese código — intenta de nuevo.');
      setTimeout(() => setAvisoEscaneo(''), 4000);
      return;
    }
    setBuscar(dniDetectado);
    setPagina(1);
    setAvisoEscaneo(`✓ Encontrado por QR — confirma marcarlo como "Registrado" abajo.`);
    setTimeout(() => setAvisoEscaneo(''), 6000);
  };
  const [filtroEvento, setFiltroEvento] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ datos: [], total: 0, limite: 50 });
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api.get('/admin/evento-actual-resumen').then(r => setEventoActual(r.data.evento_actual)).catch(() => {});
  }, []);

  const cargar = useCallback(() => {
    if (pestana === 'cumple') return;
    setCargando(true);
    if (pestana === 'actual') {
      if (!eventoActual) { setCargando(false); return; }
      api.get('/admin/participantes', { params: { buscar, pagina, evento: eventoActual.orden, solo_ciclo_actual: true, tipo_participante: filtroTipo || undefined, departamento: filtroDepto || undefined } })
        .then(r => setResultado(r.data))
        .finally(() => setCargando(false));
    } else {
      api.get('/admin/participantes', { params: { buscar, pagina, evento: filtroEvento || undefined, tipo_participante: filtroTipo || undefined, departamento: filtroDepto || undefined } })
        .then(r => setResultado(r.data))
        .finally(() => setCargando(false));
    }
  }, [buscar, pagina, filtroEvento, filtroTipo, filtroDepto, pestana, eventoActual]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarPestana = (p) => { setPestana(p); setPagina(1); setBuscar(''); };

  const eliminar = async (p) => {
    if (pestana === 'actual') {
      // Aquí solo se quita su inscripción al nivel/ciclo activo (ej. no llegó al evento).
      // El participante y su historial en otros niveles quedan intactos.
      if (!eventoActual) return;
      if (!(await confirmar({ titulo: 'Quitar del ciclo en curso', mensaje: `¿Quitar a ${p.nombre_completo} de "${eventoActual.nombre}" (ciclo en curso)? Su historial en otros niveles no se toca. Esta acción no se puede deshacer.`, textoConfirmar: 'Sí, quitar', peligro: true }))) return;
      try {
        await api.delete(`/admin/participantes/${p.id}/inscripciones/${eventoActual.orden}`);
        mostrarToast(`${p.nombre_completo} fue quitado del ciclo en curso.`, 'desmarcado');
      } catch (err) { mostrarToast(mensajeError(err), 'desmarcado'); }
    } else {
      // Aquí sí se borra al participante por completo, con todo su historial.
      if (!(await confirmar({ titulo: 'Eliminar participante', mensaje: `¿Eliminar a ${p.nombre_completo} de la base de datos por completo, incluyendo todo su historial en los 4 niveles? Esta acción no se puede deshacer.`, textoConfirmar: 'Sí, eliminar', peligro: true }))) return;
      try {
        await api.delete(`/admin/participantes/${p.id}`);
        mostrarToast(`${p.nombre_completo} fue eliminado.`, 'registrado');
      } catch (err) { mostrarToast(mensajeError(err), 'desmarcado'); }
    }
    cargar();
  };

  const abrirDetalle = async (p) => {
    const { data } = await api.get(`/admin/participantes/${p.id}`);

    // Si al nivel EN VIVO (el ciclo activo de ese evento) le falta fecha de graduación o
    // promoción, se completan automáticamente: fecha = última fecha del evento; promoción =
    // la actual. IMPORTANTE: nunca se aplica a niveles históricos (ciclo distinto al ciclo_actual
    // de ese evento) — un nivel histórico vacío se deja vacío, no se rellena con datos del
    // ciclo en vivo. Este chequeo es justamente lo que faltaba antes y causaba que se
    // "ensuciaran" datos históricos ya corregidos cada vez que alguien abría el detalle.
    const inscripcionesCompletadas = await Promise.all(data.inscripciones.map(async (insc) => {
      const esCicloEnVivo = insc.ciclo === insc.ciclo_actual;
      const faltaFecha = esCicloEnVivo && !insc.fecha_graduacion;
      const faltaPromocion = esCicloEnVivo && !insc.promocion_graduacion;
      if (!soloLectura && esCicloEnVivo && (faltaFecha || faltaPromocion)) {
        const fechaSugerida = insc.fecha_evento_fin || insc.fecha_evento;
        const nuevaFecha = faltaFecha && fechaSugerida ? fechaSugerida.slice(0, 10) : insc.fecha_graduacion;
        const nuevaPromocion = faltaPromocion && data.promocion_actual ? data.promocion_actual : insc.promocion_graduacion;
        if (nuevaFecha !== insc.fecha_graduacion || nuevaPromocion !== insc.promocion_graduacion) {
          try {
            await api.put(`/admin/participantes/${p.id}/inscripciones/${insc.orden}/graduacion`, {
              fecha_graduacion: nuevaFecha || null, promocion_graduacion: nuevaPromocion || null
            });
          } catch { /* si falla, se deja como estaba */ }
          return { ...insc, fecha_graduacion: nuevaFecha, promocion_graduacion: nuevaPromocion };
        }
      }
      return insc;
    }));

    setSeleccionado({ ...data, inscripciones: inscripcionesCompletadas, eventos_inscritos: data.inscripciones.map(i => i.orden) });
  };

// Separa el nombre completo en dos líneas para la etiqueta: nombres / apellidos.
// Usa la convención hondureña habitual de DOS apellidos — las últimas 2 palabras se toman
// como apellidos, todo lo anterior como nombres. No es perfecto (alguien con un solo
// apellido puede salir mal), pero es el mejor punto de partida sin rediseñar la base de datos.
function separarNombreApellido(nombreCompleto) {
  const palabras = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 2) {
    return { nombres: palabras[0] || '', apellidos: palabras[1] || '' };
  }
  return { nombres: palabras.slice(0, -2).join(' '), apellidos: palabras.slice(-2).join(' ') };
}

function escaparHtml(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Manda a imprimir una etiqueta de 7cm x 3.5cm (apaisada) con el nombre en dos líneas,
// usando un iframe invisible para no navegar fuera de la pantalla actual.
function imprimirEtiqueta(nombreCompleto) {
  const { nombres, apellidos } = separarNombreApellido(nombreCompleto);
  let iframe = document.getElementById('etiqueta-impresion-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'etiqueta-impresion-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html><head><style>
      @page { size: 7cm 3.5cm; margin: 0; }
      body { margin: 0; width: 7cm; height: 3.5cm; display: flex; flex-direction: column;
             align-items: center; justify-content: center; font-family: Arial, sans-serif; }
      .linea1 { font-size: 15pt; font-weight: bold; text-align: center; }
      .linea2 { font-size: 13pt; text-align: center; margin-top: 2pt; }
    </style></head>
    <body>
      <div class="linea1">${escaparHtml(nombres)}</div>
      <div class="linea2">${escaparHtml(apellidos)}</div>
    </body></html>
  `);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };
}

  const eventoParaColumna = pestana === 'actual' ? eventoActual?.orden : (filtroEvento || null);

  const [imprimirEtiquetaActivo, setImprimirEtiquetaActivo] = useState(
    () => localStorage.getItem('sfl_imprimir_etiquetas') === '1'
  );
  const cambiarImprimirEtiqueta = (activo) => {
    setImprimirEtiquetaActivo(activo);
    localStorage.setItem('sfl_imprimir_etiquetas', activo ? '1' : '0');
  };

  const toggleRegistradoPresencial = async (p) => {
    if (!puedeMarcarPresencial || !eventoParaColumna) return;
    const nuevoValor = !p.registrado_presencial;
    await api.put(`/admin/participantes/${p.id}/inscripciones/${eventoParaColumna}/presencial`, {
      registrado_presencial: nuevoValor
    });
    mostrarToast(
      nuevoValor ? `✓ ${p.nombre_completo} — Registrado` : `${p.nombre_completo} — Se desmarcó`,
      nuevoValor ? 'registrado' : 'desmarcado'
    );
    window.dispatchEvent(new Event('sfl:refrescar-evento-actual'));
    if (nuevoValor && imprimirEtiquetaActivo) {
      imprimirEtiqueta(p.nombre_completo);
    }
    cargar();
  };

  const totalPaginas = Math.max(Math.ceil(resultado.total / resultado.limite), 1);

  // Los que ya se registraron van bajando al final de la lista — así los que todavía
  // faltan por llegar se quedan siempre arriba, más fáciles de encontrar. Solo aplica
  // cuando esa columna existe (pestaña "Inscribiéndose ahora"); en "Todos los
  // participantes" se muestra en el orden normal, ya que ahí no hay esa columna.
  const datosOrdenados = eventoParaColumna
    ? [...resultado.datos].sort((a, b) => (a.registrado_presencial === b.registrado_presencial) ? 0 : a.registrado_presencial ? 1 : -1)
    : resultado.datos;

  const registradosEvento = resultado.registrados_evento ?? 0;
  const totalEvento = resultado.total_evento ?? resultado.total;

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Participantes</h1>
        <p className="text-sm text-ink/50">
          {pestana === 'cumple' ? 'Quién cumple años durante el evento actual'
            : pestana === 'actual' && eventoActual
            ? `Inscritos en "${eventoActual.nombre}" (ciclo en curso)`
            : `${resultado.total} registros en la base de datos`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => cambiarPestana('actual')} className={claseTab(pestana === 'actual', 'celeste')}>★ Inscribiéndose ahora</button>
          <button onClick={() => cambiarPestana('todos')} className={claseTab(pestana === 'todos', 'azul')}>Todos los participantes</button>
          <button onClick={() => cambiarPestana('cumple')} className={claseTab(pestana === 'cumple', 'oro')}>🎂 Cumpleañeros</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {!soloLectura && (
            <>
              <button type="button" onClick={() => setNuevoEspecial('menor')} className={btnVerde}>+ Agregar menor</button>
              <button type="button" onClick={() => setNuevoEspecial('extranjero')} className={btnVerde}>+ Agregar extranjero</button>
            </>
          )}
          {pestana !== 'cumple' && (
            <button type="button" onClick={cargar} title="Refrescar la lista"
              className="rounded-full border border-ember-light/50 bg-ember-light/15 px-4 py-2 text-sm font-semibold text-ember hover:bg-ember-light/30">
              ↻ Refrescar
            </button>
          )}
        </div>
      </div>

      {pestana !== 'cumple' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-sm">
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <form onSubmit={e => { e.preventDefault(); cargar(); }} className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Buscar por nombre, identificación o capítulo"
                value={buscar}
                onChange={e => { setBuscar(e.target.value); setPagina(1); }}
                className="min-w-[180px] flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-ember focus:ring-4 focus:ring-ember/10"
              />
              <button type="submit" className={btnVerde}>Buscar</button>
              <button type="button"
                onClick={() => { setBuscar(''); setFiltroTipo(''); setFiltroDepto(''); setFiltroEvento(''); setPagina(1); }}
                className="rounded-full border border-night-2/40 bg-night-2/10 px-4 py-2 text-sm font-semibold text-night hover:bg-night-2/20">
                Limpiar
              </button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPagina(1); }} className={claseFiltro}>
                <option value="">Todos los tipos</option>
                <option value="nacional">Nacionales</option>
                <option value="menor">Menores</option>
                <option value="extranjero">Extranjeros</option>
              </select>
              <select value={filtroDepto} onChange={e => { setFiltroDepto(e.target.value); setPagina(1); }} className={claseFiltro}>
                <option value="">Todos los departamentos</option>
                {DEPARTAMENTOS_HONDURAS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {pestana === 'todos' && (
                <select value={filtroEvento} onChange={e => { setFiltroEvento(e.target.value); setPagina(1); }} className={claseFiltro}>
                  <option value="">Todos los niveles</option>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>Inscritos en Nivel {n}</option>)}
                </select>
              )}
              {puedeMarcarPresencial && (
                <button type="button" onClick={() => setMostrarEscaner(true)}
                  className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-night shadow-sm transition hover:bg-gold-light">
                  📷 Escanear QR
                </button>
              )}
              {eventoParaColumna && (
                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink/60">
                  <input type="checkbox" checked={imprimirEtiquetaActivo} onChange={e => cambiarImprimirEtiqueta(e.target.checked)} className="h-3.5 w-3.5 accent-gold" />
                  🖨️ Imprimir etiqueta
                </label>
              )}
            </div>
          </div>

          {pestana === 'actual' && eventoActual && (
            <div className="flex min-w-[300px] items-center justify-between gap-5 rounded-xl bg-night px-6 py-2.5 text-white">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/60">Evento actual</p>
                <p className="font-display text-base font-bold leading-tight">{eventoActual.nombre}</p>
              </div>
              <p className="border-l border-white/20 pl-3 text-sm">
                <span className="font-display text-xl font-bold">{registradosEvento}</span>
                <span className="text-white/60"> / {totalEvento} registrados</span>
              </p>
            </div>
          )}
        </div>
      )}
      {eventoParaColumna && pestana !== 'cumple' && (
        <p className="mt-2 text-xs text-ink/50">
          ✓ Marca "Registrado" cuando la persona llegue físicamente. Si alguien no se presenta, elimínalo de la lista.
        </p>
      )}
      {avisoEscaneo && <p className="mt-2 rounded-lg bg-palm/10 p-2 text-sm text-palm">{avisoEscaneo}</p>}

      {pestana === 'actual' && !eventoActual && (
        <p className="mt-3 rounded-lg bg-ember/10 p-4 text-sm text-ember">
          Todavía no hay ningún nivel marcado como "evento actual". Ve a <strong>Eventos</strong> y márcalo.
        </p>
      )}

      {pestana === 'cumple' && <PanelCumpleaneros eventoActual={eventoActual} />}

      {pestana !== 'cumple' && (<>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 bg-[#1F3464]/12 text-xs font-semibold uppercase tracking-wide text-[#1F3464]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Identificación</th>
              <th className="px-4 py-3">Capítulo</th>
              <th className="px-4 py-3">Procedencia</th>
              <th className="px-4 py-3 text-center">Niveles</th>
              {eventoParaColumna && <th className="px-4 py-3 text-center">Registrado</th>}
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={eventoParaColumna ? 7 : 6} className="px-4 py-8 text-center text-ink/40">Cargando…</td></tr>}
            {!cargando && datosOrdenados.map((p, i) => (
              <tr key={p.id} className={`border-t border-ink/5 hover:bg-gold/10 ${
                p.registrado_presencial ? 'bg-palm/10' : (i % 2 === 1 ? 'bg-gold-pale/25' : 'bg-white')
              }`}>
                <td className="px-4 py-3 font-medium text-ink">
                  {p.nombre_completo}
                  {p.tipo_participante === 'menor' && (
                    <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold">Menor</span>
                  )}
                  {p.tipo_participante === 'extranjero' && (
                    <span className="ml-2 rounded-full bg-palm/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-palm">🌎 Extranjero</span>
                  )}
                  {p.fallecido && (
                    <span title="Q.E.P.D." className="ml-2 text-ink/40">✝</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/60">{textoIdentificacion(p.tipo_identificacion, p.dni)}</td>
                <td className="px-4 py-3 text-ink/60">{p.capitulo || '—'}</td>
                <td className="px-4 py-3 text-ink/60">{procedenciaDe(p.departamento, p.municipio) || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4].map(n => (
                      <span key={n} className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        (p.eventos_inscritos || []).includes(n) ? 'bg-palm/15 text-palm' : 'bg-ink/5 text-ink/30'
                      }`}>{n}</span>
                    ))}
                  </div>
                </td>
                {eventoParaColumna && (
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      disabled={!puedeMarcarPresencial}
                      checked={!!p.registrado_presencial}
                      onChange={() => toggleRegistradoPresencial(p)}
                      className="h-4 w-4 cursor-pointer accent-palm"
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <button onClick={() => abrirDetalle(p)} className={soloLectura ? btnVer : btnEditar}>{soloLectura ? 'Ver detalle' : 'Editar'}</button>
                  {!soloLectura && (
                    <button onClick={() => eliminar(p)} className={`ml-2 ${btnEliminar}`}>Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
            {!cargando && resultado.datos.length === 0 && (
              <tr><td colSpan={eventoParaColumna ? 7 : 6} className="px-4 py-8 text-center text-ink/40">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink/50">
        <span>Página {pagina} de {totalPaginas}</span>
        <div className="flex gap-2">
          <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="rounded-lg border border-ink/15 px-3 py-1 disabled:opacity-40">Anterior</button>
          <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)} className="rounded-lg border border-ink/15 px-3 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      </div>
      </>)}

      {seleccionado && (
        <ModalEditar
          participante={seleccionado}
          soloLectura={soloLectura}
          onCerrar={() => setSeleccionado(null)}
          onGuardado={(cerrar = true) => { cargar(); if (cerrar) setSeleccionado(null); }}
        />
      )}

      {nuevoEspecial && (
        <ModalParticipanteEspecial
          tipo={nuevoEspecial}
          onCerrar={() => setNuevoEspecial(null)}
          onCreado={(r) => {
            setNuevoEspecial(null);
            cargar();
            mostrarToast(`${r.nombre_completo} registrado (${r.dni})`, 'registrado');
          }}
        />
      )}

      {mostrarEscaner && (
        <ModalEscanearQR onCerrar={() => setMostrarEscaner(false)} onDetectado={procesarEscaneo} />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className={`pointer-events-auto rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-xl ${
            toast.tipo === 'registrado' ? 'bg-palm' : 'bg-ink/80'
          }`}>
            {toast.texto}
          </div>
        </div>
      )}
    </div>
  );
}
