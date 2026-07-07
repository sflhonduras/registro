import { useEffect, useState } from 'react';
import api from '../api';

export default function AdminMantenimiento() {
  const [resumen, setResumen] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const [ultimoArchivo, setUltimoArchivo] = useState('');

  useEffect(() => {
    api.get('/admin/mantenimiento/resumen').then(r => setResumen(r.data)).catch(() => {});
  }, []);

  const descargarRespaldo = async () => {
    setDescargando(true);
    setError('');
    try {
      const resp = await fetch(`${api.defaults.baseURL}/admin/mantenimiento/respaldo`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const nombre = `respaldo_sfl_${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
      setUltimoArchivo(nombre);
    } catch {
      setError('No se pudo generar el respaldo. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Mantenimiento</h1>
      <p className="mt-1 text-sm text-ink/50">
        Descarga un respaldo completo de la base de datos (eventos, participantes, inscripciones,
        servidores y configuración) en un solo archivo.
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
          Se descarga un archivo <code className="rounded bg-parchment-2 px-1">.json</code> con todos
          los datos del sistema hasta este momento. Guárdalo en un lugar seguro — por ejemplo, súbelo
          manualmente a tu carpeta de Google Drive de respaldos.
        </p>

        <button onClick={descargarRespaldo} disabled={descargando}
          className="mt-4 rounded-full bg-palm px-5 py-2 text-sm font-semibold text-white hover:bg-palm-light disabled:opacity-60">
          {descargando ? 'Generando…' : '⬇ Descargar respaldo (.json)'}
        </button>

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
