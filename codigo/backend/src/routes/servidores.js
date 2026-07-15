import { Router } from 'express';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { normalizarNombre, soloDigitos } from '../texto.js';

const router = Router();
router.use(requireAuth);
// Esta sección no es visible para el rol "cocina" (solo tiene su propio resumen dedicado).
router.use((req, res, next) => {
  if (req.user.rol === 'cocina') return res.status(403).json({ error: 'No tienes acceso a esta sección.' });
  next();
});

const COLUMNAS_EXPORT = {
  nombre_completo: 'Nombre Completo',
  dni: 'DNI',
  capitulo: 'Capítulo',
  zona: 'Zona',
  celular: 'Celular',
  estado_civil: 'Estado Civil',
  hijos_cantidad: 'Hijos',
  fecha_nacimiento: 'Fecha de Nacimiento',
  cargo_actual: 'Cargo Actual',
  email: 'E-mail'
};

// Campos editables desde el panel (además de los de siempre).
const CAMPOS_ARRAY = ['cargos_desempenados', 'formacion_oficial', 'otras_participaciones'];
const CAMPOS_EDITABLES = [
  'nombre_completo', 'dni', 'capitulo', 'celular', 'estado_civil', 'hijos_cantidad',
  'fecha_nacimiento', 'email', 'participara_evento',
  'nombre_esposa', 'nietos_cantidad', 'profesion', 'contacto_emergencia_telefono', 'foto',
  'fecha_inscripcion_capitulo', 'tiempo_fihnec', 'cargo_actual', 'zona', 'tipo_testimonio',
  ...CAMPOS_ARRAY
];

router.get('/excel', async (req, res) => {
  const { rows } = await query('SELECT * FROM servidores ORDER BY nombre_completo ASC');
  const datos = rows.map((s, i) => {
    const fila = { '#': i + 1 };
    for (const [clave, titulo] of Object.entries(COLUMNAS_EXPORT)) fila[titulo] = s[clave] ?? '';
    return fila;
  });
  const hoja = xlsx.utils.json_to_sheet(datos);
  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, hoja, 'Servidores SFL');
  const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="servidores_sfl.xlsx"');
  res.send(buffer);
});

router.get('/pdf', async (req, res) => {
  const { rows } = await query('SELECT * FROM servidores ORDER BY nombre_completo ASC');
  const columnas = Object.entries(COLUMNAS_EXPORT);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="servidores_sfl.pdf"');

  const doc = new PDFDocument({ size: 'letter', margin: 30, layout: 'landscape' });
  doc.pipe(res);
  doc.fontSize(15).font('Helvetica-Bold').text('FIHNEC · Servidores del SFL', { align: 'center' });
  doc.moveDown(1);

  const anchoDisponible = doc.page.width - 60;
  const anchoCol = anchoDisponible / (columnas.length + 1);
  const dibujarFila = (valores, negrita) => {
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    let x = 30; const y = doc.y;
    valores.forEach(v => { doc.text(String(v ?? ''), x, y, { width: anchoCol - 5 }); x += anchoCol; });
    doc.moveDown(0.6);
  };

  dibujarFila(['#', ...columnas.map(([, titulo]) => titulo)], true);
  doc.moveTo(30, doc.y).lineTo(30 + anchoDisponible, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.3);

  rows.forEach((s, i) => {
    if (doc.y > doc.page.height - 60) doc.addPage({ size: 'letter', margin: 30, layout: 'landscape' });
    dibujarFila([i + 1, ...columnas.map(([clave]) => s[clave])], false);
  });
  doc.end();
});

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM servidores ORDER BY nombre_completo ASC');
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (!b.nombre_completo) return res.status(400).json({ error: 'El nombre completo es obligatorio.' });

  const datos = { ...b };
  datos.nombre_completo = normalizarNombre(b.nombre_completo);
  if (b.capitulo) datos.capitulo = normalizarNombre(b.capitulo);
  if (b.celular) datos.celular = soloDigitos(b.celular);
  if (b.contacto_emergencia_telefono) datos.contacto_emergencia_telefono = soloDigitos(b.contacto_emergencia_telefono);
  if (b.nombre_esposa) datos.nombre_esposa = normalizarNombre(b.nombre_esposa);

  const cols = CAMPOS_EDITABLES.filter(c => datos[c] !== undefined);
  const nombresCols = cols.join(', ');
  const marcadores = cols.map((_, i) => `$${i + 1}`).join(', ');
  const vals = cols.map(c => datos[c]);

  const { rows } = await query(
    `INSERT INTO servidores (${nombresCols}) VALUES (${marcadores}) RETURNING *`,
    vals
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  const datos = { ...b };
  if (b.nombre_completo) datos.nombre_completo = normalizarNombre(b.nombre_completo);
  if (b.capitulo) datos.capitulo = normalizarNombre(b.capitulo);
  if (b.celular) datos.celular = soloDigitos(b.celular);
  if (b.contacto_emergencia_telefono) datos.contacto_emergencia_telefono = soloDigitos(b.contacto_emergencia_telefono);
  if (b.nombre_esposa) datos.nombre_esposa = normalizarNombre(b.nombre_esposa);

  const cols = CAMPOS_EDITABLES.filter(c => datos[c] !== undefined);
  if (cols.length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const vals = cols.map(c => datos[c]);
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE servidores SET ${setClause}, actualizado_en = now() WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Servidor no encontrado.' });
  res.json(rows[0]);
});

// POST /api/admin/servidores/reiniciar-participacion -> pone en falso el checkbox
// "Participará en el evento" para TODOS los servidores de una vez (ej. antes de un evento nuevo).
router.post('/reiniciar-participacion', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('UPDATE servidores SET participara_evento = FALSE WHERE participara_evento = TRUE');
  res.json({ mensaje: `Se reinició la participación de ${rowCount} servidor(es).`, actualizados: rowCount });
});

// GET /api/admin/servidores/:id/ficha -> PDF de una sola persona, con todos sus datos.
router.get('/:id/ficha', async (req, res) => {
  const { rows } = await query('SELECT * FROM servidores WHERE id = $1', [req.params.id]);
  const s = rows[0];
  if (!s) return res.status(404).json({ error: 'Servidor no encontrado.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ficha_${(s.nombre_completo || 'servidor').replace(/\s+/g, '_')}.pdf"`);

  const doc = new PDFDocument({ size: 'letter', margin: 40 });
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text('FIHNEC · Ficha del Servidor SFL', { align: 'center' });
  doc.moveDown(1.2);

  if (s.foto) {
    try {
      const base64 = s.foto.split(',').pop();
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, doc.page.width - 40 - 100, 90, { width: 100, height: 100, fit: [100, 100] });
    } catch { /* si la foto no se puede leer, se omite sin romper el PDF */ }
  }

  const fila = (etiqueta, valor) => {
    doc.font('Helvetica-Bold').fontSize(10).text(etiqueta, { continued: true });
    doc.font('Helvetica').fontSize(10).text(`  ${valor ?? '—'}`);
    doc.moveDown(0.3);
  };

  const seccion = (titulo) => {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#B23A2E').text(titulo);
    doc.fillColor('black');
    doc.moveDown(0.3);
  };

  seccion('Datos Generales');
  fila('Nombre completo:', s.nombre_completo);
  fila('DNI:', s.dni);
  fila('Fecha de nacimiento:', s.fecha_nacimiento);
  fila('Estado civil:', s.estado_civil);
  if (s.nombre_esposa) fila('Nombre de la esposa:', s.nombre_esposa);
  fila('Hijos:', s.hijos_cantidad);
  fila('Nietos:', s.nietos_cantidad);
  fila('Profesión:', s.profesion);
  fila('Celular:', s.celular);
  fila('Contacto de emergencia:', s.contacto_emergencia_telefono);
  fila('E-mail:', s.email);

  seccion('Datos Organizacionales');
  fila('Capítulo:', s.capitulo);
  fila('Zona:', s.zona);
  fila('Fecha de inscripción al capítulo:', s.fecha_inscripcion_capitulo);
  fila('Tiempo en FIHNEC:', s.tiempo_fihnec);
  fila('Cargo actual:', s.cargo_actual);
  fila('Cargos desempeñados:', (s.cargos_desempenados || []).join(', ') || '—');

  seccion('Testimonio y Formación');
  fila('Tipo de testimonio:', s.tipo_testimonio);
  fila('Formación oficial:', (s.formacion_oficial || []).join(', ') || '—');
  fila('Otras participaciones:', (s.otras_participaciones || []).join(', ') || '—');

  doc.end();
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM servidores WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Servidor no encontrado.' });
  res.json({ mensaje: 'Servidor eliminado.' });
});

export default router;
