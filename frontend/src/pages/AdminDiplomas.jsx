import { useEffect, useState } from 'react';
import api from '../api';

const NIVELES = [
  { orden: 1, nombre: 'Nivel I · Mi Relación con Dios' },
  { orden: 2, nombre: 'Nivel II · Mi Relación conmigo mismo' },
  { orden: 3, nombre: 'Nivel III · Mi Relación con los demás' },
  { orden: 4, nombre: 'Nivel IV · Salvación y Legado' },
];

export default function AdminDiplomas() {
  const [nivel, setNivel] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState('');

  useEffect(() => {
    setCargando(true);
    api.get(`/admin/diplomas/${nivel}`).then(r => setDatos(r.data)).finally(() => setCargando(false));
  }, [nivel]);

  const descargar = async (tipo) => {
    setDescargando(tipo);
    try {
      const resp = await fetch(`${api.defaults.baseURL}/admin/diplomas/${nivel}/${tipo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diplomas_nivel_${nivel}.${tipo === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando('');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Diplomas</h1>
      <p className="text-sm text-ink/50">Listado de participantes por nivel, listo para exportar y preparar diplomas.</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-parchment-2 p-1">
          {NIVELES.map(n => (
            <button
              key={n.orden}
              onClick={() => setNivel(n.orden)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                nivel === n.orden ? 'bg-ink text-parchment' : 'text-ink/50 hover:bg-ink/5'
              }`}
            >
              Nivel {n.orden}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => descargar('excel')} disabled={descargando !== ''}
            className="rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
            {descargando === 'excel' ? 'Generando…' : '⬇ Descargar Excel'}
          </button>
          <button onClick={() => descargar('pdf')} disabled={descargando !== ''}
            className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white hover:bg-ember-light disabled:opacity-60">
            {descargando === 'pdf' ? 'Generando…' : '⬇ Descargar PDF'}
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink/50">
        {NIVELES.find(n => n.orden === nivel)?.nombre} — {datos ? `${datos.total} participante(s) registrado(s)` : '…'}
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="w-16 px-4 py-3">Número</th>
              <th className="px-4 py-3">Nombre Completo</th>
              <th className="px-4 py-3">Capítulo</th>
              <th className="px-4 py-3">Cargo</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Cargando…</td></tr>}
            {!cargando && datos?.participantes.map((p, i) => (
              <tr key={i} className="border-t border-ink/5">
                <td className="px-4 py-2.5 text-ink/50">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-ink">{p.nombre_completo}</td>
                <td className="px-4 py-2.5 text-ink/60">{p.capitulo || '—'}</td>
                <td className="px-4 py-2.5 text-ink/60">{p.cargo_fihnec || '—'}</td>
              </tr>
            ))}
            {!cargando && datos?.participantes.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Todavía no hay participantes registrados en este nivel.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
