import { useEffect, useState, useCallback } from 'react';
import api, { mensajeError } from '../api';

const CAMPOS = [
  ['nombre_completo', 'Nombre completo'], ['dni', 'DNI'], ['celular', 'Celular'],
  ['capitulo', 'Capítulo'], ['zona', 'Zona'], ['departamento', 'Departamento'], ['municipio', 'Municipio'],
  ['cargo_fihnec', 'Cargo en FIHNEC'], ['estado_civil', 'Estado civil'], ['hijos_cantidad', 'Hijos'],
  ['observacion', 'Observación']
];

function ModalEditar({ participante, onCerrar, onGuardado, soloLectura }) {
  const [form, setForm] = useState(participante);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      await api.put(`/admin/participantes/${participante.id}`, form);
      onGuardado();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  const toggleInscripcion = async (orden, inscrito) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{soloLectura ? 'Detalle del participante' : 'Editar participante'}</h2>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CAMPOS.map(([campo, etiqueta]) => (
            <label key={campo} className="block text-sm">
              <span className="mb-1 block text-ink/60">{etiqueta}</span>
              <input
                disabled={soloLectura}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 disabled:bg-ink/5"
                value={form[campo] ?? ''}
                onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
              />
            </label>
          ))}
        </div>

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

        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

        {!soloLectura && (
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onCerrar} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-night hover:bg-gold-light">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminParticipantes() {
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const soloLectura = usuario?.rol !== 'admin';

  const [buscar, setBuscar] = useState('');
  const [filtroEvento, setFiltroEvento] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ datos: [], total: 0, limite: 50 });
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.get('/admin/participantes', { params: { buscar, pagina, evento: filtroEvento || undefined } })
      .then(r => setResultado(r.data))
      .finally(() => setCargando(false));
  }, [buscar, pagina, filtroEvento]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar a ${p.nombre_completo}? Esta acción no se puede deshacer.`)) return;
    await api.delete(`/admin/participantes/${p.id}`);
    cargar();
  };

  const abrirDetalle = async (p) => {
    const { data } = await api.get(`/admin/participantes/${p.id}`);
    setSeleccionado({ ...data, eventos_inscritos: data.inscripciones.map(i => i.orden) });
  };

  const totalPaginas = Math.max(Math.ceil(resultado.total / resultado.limite), 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Participantes</h1>
          <p className="text-sm text-ink/50">{resultado.total} registros en la base de datos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Buscar por nombre, DNI o capítulo…"
            value={buscar}
            onChange={e => { setBuscar(e.target.value); setPagina(1); }}
            className="rounded-lg border border-ink/15 px-3.5 py-2 text-sm"
          />
          <select value={filtroEvento} onChange={e => { setFiltroEvento(e.target.value); setPagina(1); }} className="rounded-lg border border-ink/15 px-3 py-2 text-sm">
            <option value="">Todos los niveles</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>Inscritos en Nivel {n}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">DNI</th>
              <th className="px-4 py-3">Capítulo</th>
              <th className="px-4 py-3">Niveles</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/40">Cargando…</td></tr>}
            {!cargando && resultado.datos.map(p => (
              <tr key={p.id} className="border-t border-ink/5 hover:bg-parchment-2/50">
                <td className="px-4 py-3 font-medium text-ink">{p.nombre_completo}</td>
                <td className="px-4 py-3 text-ink/60">{p.dni}</td>
                <td className="px-4 py-3 text-ink/60">{p.capitulo || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(n => (
                      <span key={n} className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        (p.eventos_inscritos || []).includes(n) ? 'bg-palm/15 text-palm' : 'bg-ink/5 text-ink/30'
                      }`}>{n}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => abrirDetalle(p)} className="text-gold hover:underline">{soloLectura ? 'Ver' : 'Editar'}</button>
                  {!soloLectura && (
                    <button onClick={() => eliminar(p)} className="ml-3 text-ember hover:underline">Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
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

      {seleccionado && (
        <ModalEditar
          participante={seleccionado}
          soloLectura={soloLectura}
          onCerrar={() => setSeleccionado(null)}
          onGuardado={(cerrar = true) => { cargar(); if (cerrar) setSeleccionado(null); }}
        />
      )}
    </div>
  );
}
