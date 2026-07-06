import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api';
import { numeroARomano } from '../romano';
import HondurasMapa from '../components/HondurasMapa';

const COLORES = ['#C9932F', '#B23A2E', '#2F5D3A', '#8A6A3C', '#6B7280'];

function Tarjeta({ titulo, valor, nota, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border border-ink/10 bg-white p-5 text-left shadow-sm transition ${onClick ? 'hover:border-gold/40 hover:shadow-md cursor-pointer' : ''}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{titulo}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{valor}</p>
      {nota && <p className="mt-1 text-xs text-ink/40">{nota}</p>}
    </button>
  );
}

export default function AdminDashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api.get('/admin/estadisticas').then(r => setDatos(r.data)).catch(() => setError('No se pudieron cargar las estadísticas.'));
  }, []);

  if (error) return <p className="text-ember">{error}</p>;
  if (!datos) return <p className="text-ink/50">Cargando estadísticas…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Estadísticas generales</h1>
        <p className="text-sm text-ink/50">Vista en tiempo real de la base de datos SFL. Haz clic en una tarjeta o barra para ver el detalle.</p>
      </div>

      {datos.promocion_actual && (
        <div className="flex items-center gap-4 rounded-2xl border border-gold/30 bg-gold/10 px-6 py-4">
          <span className="font-display text-4xl font-bold text-gold">{numeroARomano(datos.promocion_actual)}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Promoción actual</p>
            <p className="text-sm text-ink/60">Se está cursando la Promoción {numeroARomano(datos.promocion_actual)} ({datos.promocion_actual}ª)</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Total histórico" valor={datos.total_participantes} nota="Todos los registros desde siempre" onClick={() => nav('/admin/participantes')} />
        {datos.por_evento.map(e => (
          <Tarjeta key={e.orden} titulo={`${e.es_actual ? '⭐ ' : ''}Nivel ${e.orden} · Ciclo #${e.ciclo_actual}`} valor={e.total_ciclo_actual}
            nota={`${e.total_inscritos} en total histórico`}
            onClick={() => nav(`/admin/participantes?evento=${e.orden}`)} />
        ))}
      </div>
      <a
        href={`${api.defaults.baseURL}/admin/estadisticas/excel`}
        onClick={(e) => {
          e.preventDefault();
          fetch(`${api.defaults.baseURL}/admin/estadisticas/excel`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
          }).then(r => r.blob()).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'estadisticas_sfl.xlsx'; a.click();
          });
        }}
        className="inline-block rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light"
      >
        ⬇ Exportar estadísticas a Excel
      </a>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
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

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
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

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="mb-1 font-semibold text-ink">🗺️ Mapa de Honduras · Participantes por departamento</p>
          <p className="mb-4 text-xs text-ink/40">El tamaño y color de cada círculo representa cuántos participantes vienen de ese departamento. Pasa el mouse para ver los municipios.</p>
          <HondurasMapa datos={datos.mapa_departamentos || []} />
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
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

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
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
