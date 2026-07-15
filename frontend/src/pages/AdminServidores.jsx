import { useEffect, useState } from 'react';
import api, { mensajeError } from '../api';
import {
  ZONAS_FIHNEC, CARGOS_FIHNEC, ESTADOS_CIVILES, TIPOS_TESTIMONIO,
  FORMACION_OFICIAL, OTRAS_PARTICIPACIONES
} from '../listas';

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

// Evita problemas de zona horaria al comparar solo el mes de una fecha "YYYY-MM-DD".
function mesDeFecha(fechaStr) {
  if (!fechaStr) return null;
  const partes = String(fechaStr).split('-');
  if (partes.length < 2) return null;
  return parseInt(partes[1], 10) - 1;
}

function esCumpleanosEsteMes(fechaNacimiento) {
  const mes = mesDeFecha(fechaNacimiento);
  return mes !== null && mes === new Date().getMonth();
}

function ModalEditarServidor({ servidor, onCerrar, onGuardado }) {
  const [form, setForm] = useState({ cargos_desempenados: [], formacion_oficial: [], otras_participaciones: [], ...servidor });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      if (form.id) await api.put(`/admin/servidores/${form.id}`, form);
      else await api.post('/admin/servidores', form);
      onGuardado();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  const set = (clave) => (e) => setForm(f => ({ ...f, [clave]: e.target.value }));

  const campo = (clave, etiqueta, tipo = 'text') => (
    <label className="block text-sm">
      <span className="mb-1 block text-ink/60">{etiqueta}</span>
      <input
        type={tipo}
        className="w-full rounded-lg border border-ink/15 px-3 py-2"
        value={form[clave] ?? ''}
        onChange={set(clave)}
      />
    </label>
  );

  const selectSimple = (clave, etiqueta, opciones) => (
    <label className="block text-sm">
      <span className="mb-1 block text-ink/60">{etiqueta}</span>
      <select className="w-full rounded-lg border border-ink/15 px-3 py-2" value={form[clave] ?? ''} onChange={set(clave)}>
        <option value="">— Seleccionar —</option>
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  const multiSelect = (clave, etiqueta, opciones) => {
    const valores = form[clave] || [];
    const toggle = (op) => setForm(f => {
      const actuales = f[clave] || [];
      return { ...f, [clave]: actuales.includes(op) ? actuales.filter(v => v !== op) : [...actuales, op] };
    });
    return (
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm text-ink/60">{etiqueta}</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-ink/15 p-3 sm:grid-cols-3">
          {opciones.map(op => (
            <label key={op} className="flex items-center gap-1.5 text-xs text-ink/70">
              <input type="checkbox" checked={valores.includes(op)} onChange={() => toggle(op)} />
              {op}
            </label>
          ))}
        </div>
      </div>
    );
  };

  const subirFoto = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setForm(f => ({ ...f, foto: lector.result }));
    lector.readAsDataURL(archivo);
  };

  const edad = calcularEdad(form.fecha_nacimiento);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{form.id ? 'Editar servidor' : 'Nuevo servidor'}</h2>
          <button onClick={onCerrar} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gold">Datos Generales</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4">
            {form.foto && <img src={form.foto} alt="Foto" className="h-16 w-16 rounded-full object-cover" />}
            <label className="text-sm">
              <span className="mb-1 block text-ink/60">Foto</span>
              <input type="file" accept="image/*" onChange={subirFoto} className="text-xs" />
            </label>
          </div>
          <div className="sm:col-span-2">{campo('nombre_completo', 'Nombre completo')}</div>
          {campo('dni', 'DNI')}
          <label className="block text-sm">
            <span className="mb-1 block text-ink/60">Fecha de nacimiento {edad !== null && <span className="text-ink/40">({edad} años)</span>}</span>
            <input type="date" className="w-full rounded-lg border border-ink/15 px-3 py-2" value={form.fecha_nacimiento ?? ''} onChange={set('fecha_nacimiento')} />
          </label>
          {selectSimple('estado_civil', 'Estado civil', ESTADOS_CIVILES)}
          {campo('nombre_esposa', 'Nombre de la esposa (si aplica)')}
          {campo('hijos_cantidad', 'Hijos', 'number')}
          {campo('nietos_cantidad', 'Nietos', 'number')}
          {campo('profesion', 'Profesión')}
          {campo('celular', 'Celular')}
          {campo('contacto_emergencia_telefono', 'Contacto de emergencia (teléfono)')}
          <div className="sm:col-span-2">{campo('email', 'E-mail', 'email')}</div>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gold">Datos Organizacionales</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {campo('capitulo', 'Capítulo')}
          {selectSimple('zona', 'Zona', ZONAS_FIHNEC)}
          <label className="block text-sm">
            <span className="mb-1 block text-ink/60">Fecha de inscripción al capítulo</span>
            <input type="date" className="w-full rounded-lg border border-ink/15 px-3 py-2" value={form.fecha_inscripcion_capitulo ?? ''} onChange={set('fecha_inscripcion_capitulo')} />
          </label>
          {campo('tiempo_fihnec', 'Tiempo en FIHNEC (ej. "5 años")')}
          {selectSimple('cargo_actual', 'Cargo actual', CARGOS_FIHNEC)}
          {multiSelect('cargos_desempenados', 'Cargos desempeñados (histórico)', CARGOS_FIHNEC)}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gold">Testimonio y Formación</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {selectSimple('tipo_testimonio', 'Tipo de testimonio', TIPOS_TESTIMONIO)}
          {multiSelect('formacion_oficial', 'Formación oficial', FORMACION_OFICIAL)}
          {multiSelect('otras_participaciones', 'Otras participaciones', OTRAS_PARTICIPACIONES)}
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={!!form.participara_evento}
            onChange={e => setForm(f => ({ ...f, participara_evento: e.target.checked }))} />
          Participará en el evento actual
        </label>

        {error && <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCerrar} className="rounded-full px-5 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-night hover:bg-gold-light">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminServidores() {
  const usuario = JSON.parse(localStorage.getItem('sfl_user') || 'null');
  const soloLectura = usuario?.rol !== 'admin';

  const [servidores, setServidores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const [descargando, setDescargando] = useState('');
  const [reiniciando, setReiniciando] = useState(false);

  const cargar = () => api.get('/admin/servidores').then(r => setServidores(r.data)).finally(() => setCargando(false));
  useEffect(() => { cargar(); }, []);

  const toggleParticipara = async (s) => {
    if (soloLectura) return;
    await api.put(`/admin/servidores/${s.id}`, { participara_evento: !s.participara_evento });
    cargar();
  };

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar a ${s.nombre_completo} de la lista de servidores?`)) return;
    await api.delete(`/admin/servidores/${s.id}`);
    cargar();
  };

  const reiniciarParticipacion = async () => {
    if (!confirm('¿Quitar la marca "Participará en el evento" a TODOS los servidores? Esto no borra a nadie, solo reinicia el checkbox.')) return;
    setReiniciando(true);
    try {
      await api.post('/admin/servidores/reiniciar-participacion');
      cargar();
    } finally {
      setReiniciando(false);
    }
  };

  const descargar = async (tipo) => {
    setDescargando(tipo);
    try {
      const resp = await fetch(`${api.defaults.baseURL}/admin/servidores/${tipo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `servidores_sfl.${tipo === 'excel' ? 'xlsx' : 'pdf'}`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando('');
    }
  };

  const descargarFicha = async (s) => {
    const resp = await fetch(`${api.defaults.baseURL}/admin/servidores/${s.id}/ficha`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sfl_token')}` }
    });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ficha_${s.nombre_completo.replace(/\s+/g, '_')}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const COLUMNAS_IMPRESION = [
    ['nombre_completo', 'Nombre Completo'], ['capitulo', 'Capítulo'], ['celular', 'Celular'],
    ['estado_civil', 'Estado Civil'], ['hijos_cantidad', 'Hijos'], ['fecha_nacimiento', 'Fecha de Nacimiento'], ['email', 'E-mail']
  ];

  const imprimir = () => {
    const filas = servidores.map((s, i) => `
      <tr><td>${i + 1}</td>${COLUMNAS_IMPRESION.map(([clave]) => `<td>${s[clave] ?? ''}</td>`).join('')}</tr>`).join('');
    const html = `
      <html><head><title>Servidores SFL</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 11px; text-align: left; }
        th { background: #f0ede4; }
      </style></head>
      <body>
        <h1>FIHNEC · Servidores del SFL</h1>
        <table>
          <thead><tr><th>#</th>${COLUMNAS_IMPRESION.map(([, titulo]) => `<th>${titulo}</th>`).join('')}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  };

  const totalParticipando = servidores.filter(s => s.participara_evento).length;
  const totalCumpleaneros = servidores.filter(s => esCumpleanosEsteMes(s.fecha_nacimiento)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Servidores SFL</h1>
          <p className="text-sm text-ink/50">
            {servidores.length} servidores registrados · {totalParticipando} participarán en el evento actual
            {totalCumpleaneros > 0 && <> · 🎂 {totalCumpleaneros} de cumpleaños este mes</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          {!soloLectura && (
            <>
              <button onClick={reiniciarParticipacion} disabled={reiniciando}
                className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-60">
                {reiniciando ? 'Reiniciando…' : '↺ Reiniciar participación'}
              </button>
              <button onClick={() => setSeleccionado({ nombre_completo: '', participara_evento: false })}
                className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-night hover:bg-gold-light">
                + Agregar servidor
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment-2 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Nombre Completo</th>
              <th className="px-4 py-3">🎂</th>
              <th className="px-4 py-3">Participará en el Evento</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Cargando…</td></tr>}
            {!cargando && servidores.map(s => (
              <tr key={s.id} className="border-t border-ink/5">
                <td className="px-4 py-2.5 font-medium text-ink">{s.nombre_completo}</td>
                <td className="px-4 py-2.5">
                  {esCumpleanosEsteMes(s.fecha_nacimiento) && <span title="Cumpleaños este mes">🎂</span>}
                </td>
                <td className="px-4 py-2.5">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" disabled={soloLectura} checked={s.participara_evento} onChange={() => toggleParticipara(s)} />
                    <span className={s.participara_evento ? 'text-palm font-medium' : 'text-ink/40'}>
                      {s.participara_evento ? 'Sí' : 'No'}
                    </span>
                  </label>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => descargarFicha(s)} className="text-palm hover:underline">Ficha</button>
                  <button onClick={() => setSeleccionado(s)} className="ml-3 text-gold hover:underline">{soloLectura ? 'Ver' : 'Editar'}</button>
                  {!soloLectura && <button onClick={() => eliminar(s)} className="ml-3 text-ember hover:underline">Eliminar</button>}
                </td>
              </tr>
            ))}
            {!cargando && servidores.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/40">Todavía no hay servidores registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {seleccionado && (
        <ModalEditarServidor
          servidor={seleccionado}
          onCerrar={() => setSeleccionado(null)}
          onGuardado={() => { cargar(); setSeleccionado(null); }}
        />
      )}
    </div>
  );
}
