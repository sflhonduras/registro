import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api';
import { numeroARomano } from '../romano';
import HondurasMapa from '../components/HondurasMapa';

const COLORES = ['#C9932F', '#B23A2E', '#2F5D3A', '#8A6A3C', '#6B7280'];

function Tarjeta({ titulo, valor, nota, desercion, onClick, color = '#9A6136' }) {
  return (
    <button
      onClick={onClick}
      style={{ borderLeftColor: color }}
      className={`rounded-2xl border border-ink/10 border-l-4 bg-white p-3 text-left shadow-sm transition ${onClick ? 'hover:border-gold/40 hover:shadow-md cursor-pointer' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-ink/50">{titulo}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-ink">{valor}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {nota && <p className="text-[10px] text-ink/40">{nota}</p>}
        {desercion != null && (
          <p className="rounded-full bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember">
            ⚠ {desercion} deserción
          </p>
        )}
      </div>
    </button>
  );
}

const MAX_BARRAS_PROMOCION = 10;

const claseBotonDorado = 'inline-flex min-h-[30px] w-[76px] items-center justify-center rounded-full bg-[#E7B85C] px-3 text-[13px] font-bold text-[#241A12] transition hover:bg-[#F0C770]';
const claseBotonClaro = 'inline-flex min-h-[30px] w-[76px] items-center justify-center rounded-full border border-[#FBF6EC]/40 px-3 text-[13px] font-semibold text-[#FBF6EC] transition hover:bg-white/10';
const claseEtiquetaFranja = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#FBF6EC]/70';

function etiquetaPromocion(p) {
  return /^\d+$/.test(String(p)) ? numeroARomano(parseInt(p, 10)) : String(p);
}

function ordenPromocion(a, b) {
  const na = /^\d+$/.test(String(a.promocion)) ? parseInt(a.promocion, 10) : null;
  const nb = /^\d+$/.test(String(b.promocion)) ? parseInt(b.promocion, 10) : null;
  if (na != null && nb != null) return na - nb;
  return String(a.promocion).localeCompare(String(b.promocion), 'es', { numeric: true });
}

export default function AdminDashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [enlaceEnVivo, setEnlaceEnVivo] = useState(null);
  const [enlaceEnVivoCopiado, setEnlaceEnVivoCopiado] = useState(false);
  const nav = useNavigate();
  const [vistaMapa, setVistaMapa] = useState('historico');
  const [nivelMapa, setNivelMapa] = useState(2);
  const [mapaDatos, setMapaDatos] = useState(null);
  const [mapaError, setMapaError] = useState('');
  const [mapaSufijo, setMapaSufijo] = useState('');
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [selectorPromoAbierto, setSelectorPromoAbierto] = useState(false);
  const [busquedaPromo, setBusquedaPromo] = useState('');

  useEffect(() => {
    api.get('/admin/estadisticas').then(r => setDatos(r.data)).catch(() => setError('No se pudieron cargar las estadísticas.'));
    api.get('/admin/enlace-en-vivo').then(r => setEnlaceEnVivo(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setCargandoMapa(true);
    setMapaError('');
    const params = { vista: vistaMapa };
    if (vistaMapa === 'nivel' || vistaMapa === 'desercion') params.nivel = nivelMapa;
    api.get('/admin/estadisticas/mapa', { params })
      .then(r => { setMapaDatos(r.data.mapa); setMapaSufijo(r.data.sufijo || ''); })
      .catch(() => setMapaError('No se pudo cargar el mapa con esta vista.'))
      .finally(() => setCargandoMapa(false));
  }, [vistaMapa, nivelMapa]);

  const promociones = useMemo(
    () => [...(datos?.graduados_por_promocion || [])].sort(ordenPromocion),
    [datos]
  );

  function descargarExcel() {
    fetch(`${api.defaults.baseURL}/admin/estadisticas/excel`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'estadisticas_sfl.xlsx'; a.click();
    });
  }

  if (error) return <p className="text-ember">{error}</p>;
  if (!datos) return <p className="text-ink/50">Cargando estadísticas…</p>;

  const ultimasPromociones = promociones.slice(-MAX_BARRAS_PROMOCION);
  const maxPromo = Math.max(1, ...ultimasPromociones.map(p => Number(p.total) || 0));
  const totalGraduadosPromos = promociones.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const promosFiltradas = promociones
    .filter(p => {
      const q = busquedaPromo.trim().toLowerCase();
      if (!q) return true;
      return etiquetaPromocion(p.promocion).toLowerCase().includes(q) || String(p.promocion).toLowerCase().includes(q);
    })
    .reverse();
  const irPromocion = (p) => nav(`/admin/reportes?evento=4&promocion=${encodeURIComponent(p)}`);
  const tiposEspeciales = (datos.por_tipo || []).filter(t => t.tipo !== 'nacional' && t.total > 0);
  const hayFranja = datos.promocion_actual || datos.total_graduados_nivel_4 != null || datos.total_sin_requisitos != null || datos.ultimo_informe || enlaceEnVivo;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Estadísticas generales</h1>
          <p className="text-sm text-ink/50">Vista en tiempo real de la base de datos SFL. Toca una tarjeta o barra para ver el detalle.</p>
        </div>
        <button
          onClick={descargarExcel}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-palm px-5 text-sm font-semibold text-white hover:bg-palm-light"
        >
          ⬇ Exportar a Excel
        </button>
      </div>

      {hayFranja && (
        <div className="flex flex-wrap overflow-hidden rounded-2xl bg-[#241A12] text-[#FBF6EC] md:flex-nowrap">
          {datos.promocion_actual && (
            <div className="flex min-w-[170px] flex-1 basis-0 md:min-w-0 items-center gap-3.5 border-[#FBF6EC]/15 px-3.5 py-4 lg:border-r">
              <span className="font-display text-4xl font-bold leading-none text-[#E7B85C]">{numeroARomano(datos.promocion_actual)}</span>
              <div>
                <p className={claseEtiquetaFranja}>Promoción actual</p>
                <p className="mt-0.5 text-sm font-semibold">Promoción {numeroARomano(datos.promocion_actual)} ({datos.promocion_actual}ª)</p>
              </div>
            </div>
          )}
          {datos.total_graduados_nivel_4 != null && (
            <button
              onClick={() => nav('/admin/reportes?evento=4')}
              className="flex min-w-[170px] flex-1 basis-0 md:min-w-0 items-center gap-3.5 border-[#FBF6EC]/15 px-3.5 py-4 text-left transition hover:bg-white/5 lg:border-r"
            >
              <span className="text-2xl" aria-hidden="true">🎓</span>
              <div>
                <p className={claseEtiquetaFranja}>Total graduados</p>
                <p className="mt-0.5 text-sm"><b className="font-display text-xl">{datos.total_graduados_nivel_4}</b> en Nivel IV</p>
              </div>
            </button>
          )}
          {datos.total_sin_requisitos != null && (
            <button
              onClick={() => nav('/admin/diplomas/sin-requisitos')}
              className="flex min-w-[170px] flex-1 basis-0 md:min-w-0 items-center gap-3.5 border-[#FBF6EC]/15 px-3.5 py-4 text-left transition hover:bg-white/5 lg:border-r"
            >
              <span className="text-2xl" aria-hidden="true">📋</span>
              <div>
                <p className={claseEtiquetaFranja}>Sin requisitos</p>
                <p className="mt-0.5 text-sm"><b className="font-display text-xl">{datos.total_sin_requisitos}</b> por ponerse al día</p>
              </div>
            </button>
          )}
          {datos.ultimo_informe && (
            <div className="flex min-w-[250px] flex-[1.5_1_0] md:min-w-0 items-center justify-between gap-3 border-[#FBF6EC]/15 px-3.5 py-4 lg:border-r">
              <div>
                <p className={claseEtiquetaFranja}>Informe {datos.ultimo_informe.congelado ? 'de cierre' : 'en vivo'} JDN</p>
                <p className="mt-0.5 text-sm font-semibold">Nivel {numeroARomano(datos.ultimo_informe.evento_orden)}</p>
              </div>
              <div className="flex flex-none flex-col gap-1.5">
                <a href={`${window.location.origin}/informe/${datos.ultimo_informe.token}`} target="_blank" rel="noreferrer" className={claseBotonDorado}>Ver</a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/informe/${datos.ultimo_informe.token}`);
                    setEnlaceCopiado(true);
                    setTimeout(() => setEnlaceCopiado(false), 2000);
                  }}
                  className={claseBotonClaro}
                >
                  {enlaceCopiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
          {enlaceEnVivo && (
            <div className="flex min-w-[250px] flex-[1.3_1_0] md:min-w-0 items-center justify-between gap-3 px-3.5 py-4">
              <div>
                <p className={claseEtiquetaFranja}>Registro en vivo</p>
                <p className="mt-0.5 text-sm font-semibold">Público · 72 h</p>
              </div>
              <div className="flex flex-none flex-col gap-1.5">
                <a href={`${window.location.origin}/en-vivo/${enlaceEnVivo.token}`} target="_blank" rel="noreferrer" className={claseBotonDorado}>Ver</a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/en-vivo/${enlaceEnVivo.token}`);
                    setEnlaceEnVivoCopiado(true);
                    setTimeout(() => setEnlaceEnVivoCopiado(false), 2000);
                  }}
                  className={claseBotonClaro}
                >
                  {enlaceEnVivoCopiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tarjeta titulo="Total histórico" valor={datos.total_participantes} nota="Todos los registros" color="#9A6136"
          onClick={() => nav('/admin/reportes?evento=todos')} />
        {datos.por_evento.map((e, i) => (
          <Tarjeta key={e.orden} titulo={`${e.es_actual ? '⭐ ' : ''}Nivel ${e.orden} · Ciclo #${e.ciclo_actual}`} valor={e.total_ciclo_actual}
            nota={`${e.total_inscritos} histórico`} desercion={e.desercion}
            color={['#C9932F', '#F59D24', '#2F5D3A', '#9A6136'][i % 4]}
            onClick={() => nav(`/admin/reportes?evento=${e.orden}&alcance=ciclo_actual`)} />
        ))}
        {tiposEspeciales.length > 0 && (
          <div className="flex flex-col justify-center gap-2 rounded-2xl border border-ink/10 bg-gold/10 p-3">
            {tiposEspeciales.map((t, i) => (
              <div key={t.tipo}>
                {i > 0 && <div className="mb-2 h-px bg-ink/10" />}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink/60">{t.tipo === 'menor' ? 'Menores' : 'Extranjeros'}</span>
                  <b className="font-display text-xl text-ink">{t.total}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {promociones.length > 0 && (
        <div className="rounded-2xl border border-ink/10 border-l-4 border-l-[#C9932F] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">🎓 Graduados por promoción</p>
              <p className="text-xs text-ink/50">
                {promociones.length} promoción(es) · {totalGraduadosPromos} graduados en total
                {promociones.length > MAX_BARRAS_PROMOCION ? ` · se muestran las últimas ${MAX_BARRAS_PROMOCION}` : ''}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setSelectorPromoAbierto(v => !v)}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-[13px] font-semibold text-ink hover:border-gold/60"
                aria-expanded={selectorPromoAbierto}
              >
                Otra promoción <span className="text-[10px]">▾</span>
              </button>
              {selectorPromoAbierto && (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-ink/15 bg-white p-2 shadow-lg">
                  <input
                    autoFocus
                    value={busquedaPromo}
                    onChange={e => setBusquedaPromo(e.target.value)}
                    placeholder="Buscar (ej. 23 o XXIII)"
                    className="mb-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                  />
                  <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                    {promosFiltradas.map(p => (
                      <li key={p.promocion}>
                        <button
                          onClick={() => { setSelectorPromoAbierto(false); setBusquedaPromo(''); irPromocion(p.promocion); }}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-gold/10"
                        >
                          <span className="font-display font-bold text-gold">Promoción {etiquetaPromocion(p.promocion)}</span>
                          <span className="text-xs text-ink/50">{p.total}</span>
                        </button>
                      </li>
                    ))}
                    {promosFiltradas.length === 0 && <li className="px-3 py-2 text-xs text-ink/40">Sin resultados.</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-end gap-1.5 overflow-x-auto border-b border-ink/10">
            {ultimasPromociones.map(p => {
              const alto = 8 + ((Number(p.total) || 0) / maxPromo) * 64;
              return (
                <button
                  key={p.promocion}
                  onClick={() => irPromocion(p.promocion)}
                  title={`Promoción ${etiquetaPromocion(p.promocion)}: ${p.total} graduado(s)`}
                  className="group flex h-[112px] min-w-[44px] flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-xs font-semibold text-ink">{p.total}</span>
                  <span className="w-full max-w-[38px] rounded-t-md bg-[#C9932F] transition group-hover:bg-[#B3811F]" style={{ height: alto }} />
                  <b className="font-display text-sm text-[#8A5F12]">{etiquetaPromocion(p.promocion)}</b>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 border-l-4 border-l-[#2F5D3A] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 font-semibold text-ink">🗺️ Mapa de Honduras</p>
            <p className="text-xs text-ink/40">Pasa el mouse para ver los municipios, o haz clic en un departamento para ver el reporte completo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={vistaMapa} onChange={e => setVistaMapa(e.target.value)} className="rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs">
              <option value="historico">Total histórico</option>
              <option value="ciclo_actual">Solo ciclo actual</option>
              <option value="nivel">Por nivel específico</option>
              <option value="desercion">Tasa de deserción</option>
            </select>
            {vistaMapa === 'nivel' && (
              <select value={nivelMapa} onChange={e => setNivelMapa(Number(e.target.value))} className="rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs">
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Nivel {n}</option>)}
              </select>
            )}
            {vistaMapa === 'desercion' && (
              <select value={nivelMapa === 1 ? 2 : nivelMapa} onChange={e => setNivelMapa(Number(e.target.value))} className="rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs">
                {[2, 3, 4].map(n => <option key={n} value={n}>Deserción Nivel {n}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="mt-4">
          {cargandoMapa ? (
            <p className="py-10 text-center text-sm text-ink/40">Cargando mapa…</p>
          ) : mapaError ? (
            <p className="py-10 text-center text-sm text-ember">{mapaError}</p>
          ) : !mapaDatos ? (
            <p className="py-10 text-center text-sm text-ink/40">Sin datos para mostrar.</p>
          ) : (
            <HondurasMapa
              datos={mapaDatos}
              sufijo={mapaSufijo}
              onDepartamentoClick={(departamento) => nav(`/admin/reportes?evento=todos&departamento=${encodeURIComponent(departamento)}`)}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 border-l-4 border-l-[#C9932F] bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Embudo de avance por nivel</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.embudo} onClick={(e) => e?.activeLabel && nav(`/admin/participantes?evento=${e.activeLabel}`)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="orden" tickFormatter={v => `Nivel ${v}`} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip labelFormatter={v => `Nivel ${v}`} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#C9932F" className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-ink/10 border-l-4 border-l-[#9A6136] bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Distribución de participantes por nivel</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={datos.por_evento}
                dataKey="total_inscritos"
                nameKey="nombre"
                cx="50%" cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                onClick={(d) => nav(`/admin/participantes?evento=${d.orden}`)}
                className="cursor-pointer"
              >
                {datos.por_evento.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-ink/10 border-l-4 border-l-[#2F5D3A] bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Participantes por zona</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos.por_zona.slice(0, 12)} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="zona" fontSize={10} width={110} />
              <Tooltip />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#2F5D3A" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-ink/10 border-l-4 border-l-ember bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Participantes por departamento</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos.por_departamento} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="departamento" fontSize={10} width={130} />
              <Tooltip />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#B23A2E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
