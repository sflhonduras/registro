import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api';
import { procedenciaDe } from '../listas';

// Cumpleañeros del evento actual: quienes cumplen años entre el primer y el último día
// del evento, agrupados por día. Incluye PDF para descargar o imprimir.
export default function PanelCumpleaneros({ eventoActual }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [mayusculas, setMayusculas] = useState(false);
  const [generando, setGenerando] = useState('');

  useEffect(() => {
    if (!eventoActual) return;
    setDatos(null); setError('');
    api.get(`/admin/eventos/${eventoActual.orden}/cumpleaneros`)
      .then(r => setDatos(r.data))
      .catch(err => setError(mensajeError(err)));
  }, [eventoActual]);

  if (!eventoActual) {
    return (
      <p className="mt-3 rounded-lg bg-ember/10 p-4 text-sm text-ember">
        Todavía no hay ningún nivel marcado como "evento actual". Ve a <strong>Eventos</strong> y márcalo.
      </p>
    );
  }

  const pdf = async (modo) => {
    // La pestaña se abre ANTES de la llamada, o el navegador la bloquea como pop-up.
    const ventana = modo === 'imprimir' ? window.open('', '_blank') : null;
    setGenerando(modo); setError('');
    try {
      const { data } = await api.get(`/admin/eventos/${eventoActual.orden}/cumpleaneros/pdf`, {
        responseType: 'blob', params: mayusculas ? { mayusculas: 1 } : undefined,
      });
      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      if (modo === 'imprimir') {
        if (ventana) ventana.location.href = url; else window.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `cumpleaneros_${eventoActual.nombre.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      setError('No se pudo generar el PDF de cumpleañeros.');
      if (ventana) ventana.close();
    } finally {
      setGenerando('');
    }
  };

  const total = datos?.total ?? 0;
  return (
    <div className="mt-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">🎂 Cumpleañeros de {eventoActual.nombre} ({total})</p>
          <p className="text-xs text-ink/50">Inscritos del ciclo en curso que cumplen años durante el evento. Solo aparece quien tiene fecha de nacimiento guardada.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
            <input type="checkbox" checked={mayusculas} onChange={e => setMayusculas(e.target.checked)} className="h-3.5 w-3.5 accent-gold" />
            PDF en MAYÚSCULAS
          </label>
          <button type="button" disabled={total === 0 || generando !== ''} onClick={() => pdf('descargar')}
            className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-night hover:bg-gold-light disabled:opacity-50">
            {generando === 'descargar' ? 'Generando…' : '⬇ Descargar PDF'}
          </button>
          <button type="button" disabled={total === 0 || generando !== ''} onClick={() => pdf('imprimir')}
            className="rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-50">
            {generando === 'imprimir' ? 'Abriendo…' : '🖨 Imprimir'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}
      {!datos && !error && <p className="mt-4 text-sm text-ink/40">Cargando…</p>}
      {datos && total === 0 && (
        <p className="mt-4 text-sm text-ink/50">Nadie de los inscritos cumple años durante este evento.</p>
      )}

      {datos?.grupos.map(g => (
        <div key={g.clave} className="mt-4">
          <p className="rounded-lg bg-gold-pale/60 px-3 py-1.5 text-sm font-semibold text-night">{g.titulo} · {g.items.length}</p>
          <ul className="mt-1 divide-y divide-ink/5">
            {g.items.map(c => (
              <li key={c.participante_id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
                <span className="font-medium text-ink">
                  {c.nombre_completo}
                  {c.tipo_participante === 'menor' && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold">Menor</span>}
                </span>
                <span className="text-ink/60">Cumple {c.edad} años</span>
                <span className="text-ink/50">{c.capitulo || '—'}</span>
                <span className="text-ink/50">{procedenciaDe(c.departamento, c.municipio) || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
