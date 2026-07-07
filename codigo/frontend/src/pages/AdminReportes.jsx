import { useEffect, useState } from 'react';
import api from '../api';
import { ZONAS_FIHNEC, DEPARTAMENTOS_HONDURAS } from '../listas';

const NIVELES = [
  { valor: 'todos', etiqueta: 'Todos los participantes' },
  { valor: '1', etiqueta: 'Nivel I' },
  { valor: '2', etiqueta: 'Nivel II' },
  { valor: '3', etiqueta: 'Nivel III' },
  { valor: '4', etiqueta: 'Nivel IV' },
];

const CAMPOS_POR_DEFECTO = ['nombre_completo', 'dni', 'celular', 'capitulo', 'zona', 'cargo_fihnec'];

export default function AdminReportes() {
  const [camposDisponibles, setCamposDisponibles] = useState(null);
  const [nivel, setNivel] = useState('todos');
  const [alcance, setAlcance] = useState('historico');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [zona, setZona] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [capitulo, setCapitulo] = useState('');
  const [campos, setCampos] = useState(CAMPOS_POR_DEFECTO);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/reportes/campos-disponibles').then(r => setCamposDisponibles(r.data));
  }, []);

  const toggleCampo = (campo) => {
    setCampos(cs => cs.includes(campo) ? cs.filter(c => c !== campo) : [...cs, campo]);
  };

  const construirParametros = () => {
    const params = new URLSearchParams();
    params.set('evento', nivel);
    if (nivel !== 'todos') {
      params.set('alcance', alcance);
      if (alcance === 'rango') { params.set('desde', desde); params.set('hasta', hasta); }
    }
    if (zona) params.set('zona', zona);
    if (departamento) params.set('departamento', departamento);
    if (capitulo) params.set('capitulo', capitulo);
    params.set('campos', campos.join(','));
    return params;
  };

  const generar = async () => {
    setError(''); setCargando(true);
    try {
      const { data } = await api.get(`/admin/reportes?${construirParametros()}`);
      setResultado(data);
    } catch {
      setError('No se pudo generar el reporte.');
    } finally {
      setCargando(false);
    }
  };

  const descargar = async (tipo) => {
    setDescargando(tipo);
    try {
      const resp = await fetch(`${api.defaults.baseURL}/admin/reportes/${tipo}?${construirParametros()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `reporte_sfl.${tipo === 'excel' ? 'xlsx' : 'pdf'}`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando('');
    }
  };

  const imprimir = () => {
    if (!resultado) return;
    const filas = resultado.filas.map((f, i) => `
      <tr><td>${i + 1}</td>${resultado.columnas.map(c => `<td>${f[c.clave] ?? ''}</td>`).join('')}</tr>`).join('');
    const html = `
      <html><head><title>Reporte SFL</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 11px; text-align: left; }
        th { background: #f0ede4; }
      </style></head>
      <body>
        <h1>FIHNEC · Reporte de participantes</h1>
        <table>
          <thead><tr><th>#</th>${resultado.columnas.map(c => `<th>${c.titulo}</th>`).join('')}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  };

  if (!camposDisponibles) return <p className="text-ink/50">Cargando…</p>;

  const claseSelect = 'rounded-lg border border-ink/15 px-3 py-2 text-sm';

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Reportería</h1>
      <p className="text-sm text-ink/50">Arma el reporte que necesitas: elige el nivel, los filtros y las columnas, y descárgalo o imprímelo.</p>

      <div className="mt-5 space-y-5 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        {/* Filtros principales */}
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Nivel</span>
            <select value={nivel} onChange={e => setNivel(e.target.value)} className={claseSelect}>
              {NIVELES.map(n => <option key={n.valor} value={n.valor}>{n.etiqueta}</option>)}
            </select>
          </label>

          {nivel !== 'todos' && (
            <label className="text-sm">
              <span className="mb-1 block text-ink/60">¿Qué registros?</span>
              <select value={alcance} onChange={e => setAlcance(e.target.value)} className={claseSelect}>
                <option value="historico">Todo el historial</option>
                <option value="ciclo_actual">Solo el ciclo actual</option>
                <option value="rango">Rango de fechas personalizado</option>
              </select>
            </label>
          )}

          {nivel !== 'todos' && alcance === 'rango' && (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Desde</span>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={claseSelect} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Hasta</span>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={claseSelect} />
              </label>
            </>
          )}

          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Zona (opcional)</span>
            <select value={zona} onChange={e => setZona(e.target.value)} className={claseSelect}>
              <option value="">Todas</option>
              {ZONAS_FIHNEC.map(z => <option key={z}>{z}</option>)}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Departamento (opcional)</span>
            <select value={departamento} onChange={e => setDepartamento(e.target.value)} className={claseSelect}>
              <option value="">Todos</option>
              {DEPARTAMENTOS_HONDURAS.map(d => <option key={d}>{d}</option>)}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Capítulo contiene (opcional)</span>
            <input value={capitulo} onChange={e => setCapitulo(e.target.value)} placeholder="Ej. Alameda" className={claseSelect} />
          </label>
        </div>

        {/* Selección de columnas */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Columnas a incluir en el reporte</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(camposDisponibles.participante).map(([clave, titulo]) => (
              <label key={clave} className="flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={campos.includes(clave)} onChange={() => toggleCampo(clave)} />
                {titulo}
              </label>
            ))}
            {nivel !== 'todos' && Object.entries(camposDisponibles.inscripcion).map(([clave, titulo]) => (
              <label key={clave} className="flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={campos.includes(clave)} onChange={() => toggleCampo(clave)} />
                {titulo}
              </label>
            ))}
          </div>
        </div>

        <button onClick={generar} disabled={cargando}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-60">
          {cargando ? 'Generando…' : '📊 Generar reporte'}
        </button>
        {error && <p className="text-sm text-ember">{error}</p>}
      </div>

      {resultado && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/60">{resultado.total} resultado(s)</p>
            <div className="flex gap-2">
              <button onClick={imprimir} className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:bg-ink/5">
                🖨️ Imprimir
              </button>
              <button onClick={() => descargar('excel')} disabled={descargando !== ''}
                className="rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
                {descargando === 'excel' ? 'Generando…' : '⬇ Excel'}
              </button>
              <button onClick={() => descargar('pdf')} disabled={descargando !== ''}
                className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white hover:bg-ember-light disabled:opacity-60">
                {descargando === 'pdf' ? 'Generando…' : '⬇ PDF'}
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-4 py-3">#</th>
                  {resultado.columnas.map(c => <th key={c.clave} className="px-4 py-3">{c.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => (
                  <tr key={i} className="border-t border-ink/5">
                    <td className="px-4 py-2 text-ink/50">{i + 1}</td>
                    {resultado.columnas.map(c => <td key={c.clave} className="px-4 py-2 text-ink/70">{String(f[c.clave] ?? '—')}</td>)}
                  </tr>
                ))}
                {resultado.filas.length === 0 && (
                  <tr><td colSpan={resultado.columnas.length + 1} className="px-4 py-8 text-center text-ink/40">Sin resultados con estos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
