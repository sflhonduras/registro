import { useEffect, useState } from 'react';
import api from '../api';

export default function AdminMantenimiento() {
  const [resumen, setResumen] = useState(null);
  const [descargando, setDescargando] = useState('');
  const [error, setError] = useState('');
  const [ultimoArchivo, setUltimoArchivo] = useState('');

  useEffect(() => {
    api.get('/admin/mantenimiento/resumen').then(r => setResumen(r.data)).catch(() => {});
  }, []);

  const descargarRespaldo = async (formato) => {
    setDescargando(formato);
    setError('');
    try {
      const ruta = formato === 'excel' ? 'respaldo-excel' : 'respaldo';
      const extension = formato === 'excel' ? 'xlsx' : 'json';
      const resp = await fetch(`${api.defaults.baseURL}/admin/mantenimiento/${ruta}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const nombre = `respaldo_sfl_${new Date().toISOString().slice(0, 10)}.${extension}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
      setUltimoArchivo(nombre);
    } catch {
      setError('No se pudo generar el respaldo. Intenta de nuevo.');
    } finally {
      setDescargando('');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Mantenimiento</h1>
      <p className="mt-1 text-sm text-ink/50">
        Descarga un respaldo completo de la base de datos (eventos, participantes, inscripciones,
        servidores y configuración) en el formato que prefieras.
      </p>

      {resumen && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Participantes', resumen.participantes],
            ['Inscripciones', resumen.inscripciones],
            ['Servidores', resumen.servidores],
            ['Eventos', resumen.eventos]
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm">
              <p className="font-display text-2xl font-bold text-ink">{valor}</p>
              <p className="text-xs text-ink/50">{etiqueta}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <p className="font-semibold text-ink">💾 Respaldo completo</p>
        <p className="mt-1 text-sm text-ink/50">
          Elige el formato: <strong>.xlsx</strong> para revisar los datos fácilmente en Excel (una hoja
          por cada tabla), o <strong>.json</strong> si necesitas el respaldo técnico completo. Guárdalo
          en un lugar seguro — por ejemplo, súbelo manualmente a tu carpeta de Google Drive de respaldos.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => descargarRespaldo('excel')} disabled={descargando !== ''}
            className="rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
            {descargando === 'excel' ? 'Generando…' : '⬇ Descargar Excel (.xlsx)'}
          </button>
          <button onClick={() => descargarRespaldo('json')} disabled={descargando !== ''}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-60">
            {descargando === 'json' ? 'Generando…' : '⬇ Descargar JSON (.json)'}
          </button>
        </div>

        {ultimoArchivo && !error && (
          <p className="mt-3 text-sm text-palm">
            ✓ Se descargó <strong>{ultimoArchivo}</strong>. Ahora puedes subirlo a tu carpeta de Drive.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
      </div>
    </div>
  );
}
