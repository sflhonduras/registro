import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api';

const COLORES = ['#C9932F', '#B23A2E', '#2F5D3A', '#8A6A3C', '#6B7280'];
const RANGOS = [
  { valor: 7, etiqueta: 'Últimos 7 días' },
  { valor: 30, etiqueta: 'Últimos 30 días' },
  { valor: 90, etiqueta: 'Últimos 90 días' },
  { valor: 0, etiqueta: 'Todo el historial' },
];

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
  const [rangoDias, setRangoDias] = useState(30);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/admin/estadisticas').then(r => setDatos(r.data)).catch(() => setError('No se pudieron cargar las estadísticas.'));
  }, []);

  const diasFiltrados = useMemo(() => {
    if (!datos) return [];
    if (!rangoDias) return datos.inscripciones_por_dia;
    const corte = new Date();
    corte.setDate(corte.getDate() - rangoDias);
    return datos.inscripciones_por_dia.filter(d => new Date(d.dia) >= corte);
  }, [datos, rangoDias]);

  if (error) return <p className="text-ember">{error}</p>;
  if (!datos) return <p className="text-ink/50">Cargando estadísticas…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Estadísticas generales</h1>
        <p className="text-sm text-ink/50">Vista en tiempo real de la base de datos SFL. Haz clic en una tarjeta o barra para ver el detalle.</p>
      </div>

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-ink">Inscripciones por día</p>
            <div className="flex gap-1 rounded-full bg-parchment-2 p-1">
              {RANGOS.map(r => (
                <button
                  key={r.valor}
                  onClick={() => setRangoDias(r.valor)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    rangoDias === r.valor ? 'bg-ink text-parchment' : 'text-ink/50 hover:bg-ink/5'
                  }`}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={diasFiltrados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#B23A2E" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
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

      <a
        href={`${api.defaults.baseURL}/admin/exportar/participantes.csv`}
        onClick={(e) => {
          e.preventDefault();
          fetch(`${api.defaults.baseURL}/admin/exportar/participantes.csv`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
          }).then(r => r.blob()).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'participantes_sfl.csv'; a.click();
          });
        }}
        className="inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-parchment hover:bg-ember"
      >
        ⬇ Exportar base de datos (CSV)
      </a>
    </div>
  );
}
