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
  capitulo: 'Capítulo',
  celular: 'Celular',
  estado_civil: 'Estado Civil',
  hijos_cantidad: 'Hijos',
  fecha_nacimiento: 'Fecha de Nacimiento',
  email: 'E-mail'
};

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
  const { rows } = await query(
    `INSERT INTO servidores (nombre_completo, capitulo, celular, estado_civil, hijos_cantidad, fecha_nacimiento, email, participara_evento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      normalizarNombre(b.nombre_completo), b.capitulo ? normalizarNombre(b.capitulo) : null,
      b.celular ? soloDigitos(b.celular) : null, b.estado_civil || null,
      b.hijos_cantidad ? parseInt(b.hijos_cantidad, 10) : null, b.fecha_nacimiento || null,
      b.email || null, !!b.participara_evento
    ]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  const campos = ['nombre_completo', 'capitulo', 'celular', 'estado_civil', 'hijos_cantidad', 'fecha_nacimiento', 'email', 'participara_evento'];
  const cols = campos.filter(c => b[c] !== undefined);
  if (cols.length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });
  if (b.nombre_completo) b.nombre_completo = normalizarNombre(b.nombre_completo);
  if (b.capitulo) b.capitulo = normalizarNombre(b.capitulo);
  if (b.celular) b.celular = soloDigitos(b.celular);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const vals = cols.map(c => b[c]);
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE servidores SET ${setClause}, actualizado_en = now() WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Servidor no encontrado.' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM servidores WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Servidor no encontrado.' });
  res.json({ mensaje: 'Servidor eliminado.' });
});

export default router;
