import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import api from '../api';

const COLORES = ['#C9932F', '#B23A2E', '#2F5D3A', '#8A6A3C', '#6B7280'];

function Tarjeta({ titulo, valor, nota }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{titulo}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{valor}</p>
      {nota && <p className="mt-1 text-xs text-ink/40">{nota}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/estadisticas').then(r => setDatos(r.data)).catch(() => setError('No se pudieron cargar las estadísticas.'));
  }, []);

  if (error) return <p className="text-ember">{error}</p>;
  if (!datos) return <p className="text-ink/50">Cargando estadísticas…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Estadísticas generales</h1>
        <p className="text-sm text-ink/50">Vista en tiempo real de la base de datos SFL.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Total de participantes" valor={datos.total_participantes} />
        {datos.por_evento.map(e => (
          <Tarjeta key={e.orden} titulo={`Nivel ${e.orden}`} valor={e.total_inscritos} nota={e.nombre} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Embudo de avance por nivel</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.embudo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="orden" tickFormatter={v => `Nivel ${v}`} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip labelFormatter={v => `Nivel ${v}`} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#C9932F" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Inscripciones por día</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={datos.inscripciones_por_dia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#B23A2E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-ink">Participantes por zona</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos.por_zona} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis type="number" fontSize={12} />
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
              <XAxis type="number" fontSize={12} />
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
