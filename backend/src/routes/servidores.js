import { Router } from 'express';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { requireAuth, requireModulo } from '../auth.js';
import { normalizarNombre, soloDigitos } from '../texto.js';
import { guardarEnPapelera } from '../papelera.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');

const router = Router();
router.use(requireAuth);
// Esta sección no es visible para el rol "cocina" (solo tiene su propio resumen dedicado).
router.use((req, res, next) => {
  if (req.user.rol === 'cocina') return res.status(403).json({ error: 'No tienes acceso a esta sección.' });
  next();
});
router.use(requireModulo('servidores', 'consulta'));

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

router.post('/', requireModulo('servidores', 'edicion'), async (req, res) => {
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

router.put('/:id', requireModulo('servidores', 'edicion'), async (req, res) => {
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
router.post('/reiniciar-participacion', requireModulo('servidores', 'edicion'), async (req, res) => {
  const { rowCount } = await query('UPDATE servidores SET participara_evento = FALSE WHERE participara_evento = TRUE');
  res.json({ mensaje: `Se reinició la participación de ${rowCount} servidor(es).`, actualizados: rowCount });
});

// ---------- Colores de marca (mismos de la web) ----------
const NIGHT = '#241A12';
const GOLD = '#C9932F';
const BANNER_BG = '#F1E6CC';
const PARCHMENT = '#FBF6EC';
const INK = '#2B2118';
const INK_SOFT = '#6B5F52';
const LINEA = '#D8CBAE';

const TIPOS_TESTIMONIO_LISTA = ['No comparte', 'Personal', 'Familiar', 'Matrimonio', 'Internacional', 'Otro'];
const FORMACION_OFICIAL_LISTA = ['Escuela de la Visión', 'LGMFT', 'SAEL', 'SFL I', 'SFL II', 'SFL III', 'SFL IV', 'SEMAT', 'SEPREL'];
const OTRAS_PARTICIPACIONES_LISTA = [
  'Encuentros Zonales', 'Encuentros Nacionales', 'Convenciones Nacionales', 'Convención Internacional',
  'Vigilias de Capítulo', 'Vigilias de Equipo', 'Vigilias Zonales'
];

function calcularEdad(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const nac = new Date(fecha);
  if (isNaN(nac)) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

function formatearFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d)) return fecha;
  // timeZone: 'UTC' evita que la fecha se recorra un día si el servidor alguna vez corre en
  // otra zona horaria distinta a UTC (mismo tipo de bug que se corrigió en el frontend, ver
  // AdminParticipantes.jsx).
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// GET /api/admin/servidores/:id/ficha -> PDF de una sola persona, en 1 página horizontal,
// con el logo y los colores de marca de FIHNEC.
router.get('/:id/ficha', async (req, res) => {
  const { rows } = await query('SELECT * FROM servidores WHERE id = $1', [req.params.id]);
  const s = rows[0];
  if (!s) return res.status(404).json({ error: 'Servidor no encontrado.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ficha_${(s.nombre_completo || 'servidor').replace(/\s+/g, '_')}.pdf"`);

  const doc = new PDFDocument({ size: 'letter', layout: 'landscape', margin: 0 });
  doc.pipe(res);

  const ANCHO = doc.page.width, ALTO_PAG = doc.page.height, MARGEN = 34, ANCHO_UTIL = ANCHO - MARGEN * 2;
  const ALTO_HEADER = 70;

  // ---------- Encabezado ----------
  doc.rect(0, 0, ANCHO, ALTO_HEADER).fill(NIGHT);
  doc.rect(0, ALTO_HEADER, ANCHO, 3).fill(GOLD);
  try { doc.image(LOGO_PATH, MARGEN, 8, { height: 54 }); } catch { /* logo opcional */ }
  doc.fillColor(PARCHMENT).font('Helvetica').fontSize(8).text('FIHNEC HONDURAS', MARGEN + 68, 18, { characterSpacing: 2 });
  doc.fillColor(GOLD).font('Times-Bold').fontSize(18).text('Ficha del Servidor SFL', MARGEN + 68, 29);
  doc.fillColor(PARCHMENT).font('Helvetica').fontSize(9).text('Seminario para la Formación de Líderes', MARGEN + 68, 51);

  let y = ALTO_HEADER + 16;

  // Casilla de verificación dibujada (evita depender de símbolos unicode que la fuente no soporta)
  function casilla(x, yPos, marcada, tam = 8) {
    doc.rect(x, yPos, tam, tam).lineWidth(1).strokeColor(NIGHT).stroke();
    if (marcada) doc.rect(x + 1.6, yPos + 1.6, tam - 3.2, tam - 3.2).fill(GOLD);
  }

  // ---------- Columna izquierda: foto ----------
  const FOTO_ANCHO = 118, FOTO_ALTO = 138;
  const xFoto = MARGEN;
  if (s.foto) {
    try {
      const base64 = s.foto.split(',').pop();
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, xFoto, y, { width: FOTO_ANCHO, height: FOTO_ALTO, fit: [FOTO_ANCHO, FOTO_ALTO] });
      doc.rect(xFoto, y, FOTO_ANCHO, FOTO_ALTO).lineWidth(1.2).strokeColor(NIGHT).stroke();
    } catch {
      doc.rect(xFoto, y, FOTO_ANCHO, FOTO_ALTO).fill('#F3ECDD');
      doc.rect(xFoto, y, FOTO_ANCHO, FOTO_ALTO).lineWidth(1.2).strokeColor(NIGHT).stroke();
    }
  } else {
    const iniciales = (s.nombre_completo || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    doc.rect(xFoto, y, FOTO_ANCHO, FOTO_ALTO).fill('#F3ECDD');
    doc.fillColor(GOLD).font('Times-Bold').fontSize(34).text(iniciales, xFoto, y + FOTO_ALTO / 2 - 20, { width: FOTO_ANCHO, align: 'center' });
    doc.rect(xFoto, y, FOTO_ANCHO, FOTO_ALTO).lineWidth(1.2).strokeColor(NIGHT).stroke();
  }

  // Nombre/cargo/capítulo debajo de la foto, con alto dinámico (evita que se encimen si el nombre es largo)
  let yTexto = y + FOTO_ALTO + 8;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5);
  const altoNombre = doc.heightOfString(s.nombre_completo || '', { width: FOTO_ANCHO, align: 'center' });
  doc.text(s.nombre_completo || '', xFoto, yTexto, { width: FOTO_ANCHO, align: 'center' });
  yTexto += altoNombre + 3;
  if (s.cargo_actual) {
    doc.fillColor(NIGHT).font('Helvetica-Bold').fontSize(8.5);
    const altoCargo = doc.heightOfString(s.cargo_actual, { width: FOTO_ANCHO, align: 'center' });
    doc.text(s.cargo_actual, xFoto, yTexto, { width: FOTO_ANCHO, align: 'center' });
    yTexto += altoCargo + 3;
  }
  if (s.capitulo) doc.fillColor(INK_SOFT).font('Helvetica').fontSize(8).text(`Capítulo ${s.capitulo}`, xFoto, yTexto, { width: FOTO_ANCHO, align: 'center' });

  // ---------- Columna derecha: recuadros ----------
  const xCaja = xFoto + FOTO_ANCHO + 22;
  const anchoCaja = ANCHO - MARGEN - xCaja;

  function bannerCaja(titulo, alturaCaja) {
    doc.rect(xCaja, y, anchoCaja, alturaCaja).lineWidth(1).strokeColor(NIGHT).stroke();
    doc.rect(xCaja, y, anchoCaja, 16).fill(BANNER_BG);
    doc.rect(xCaja, y, anchoCaja, 16).lineWidth(1).strokeColor(NIGHT).stroke();
    doc.fillColor(NIGHT).font('Helvetica-Bold').fontSize(9).text(titulo, xCaja, y + 4, { width: anchoCaja, align: 'center', characterSpacing: 0.5 });
    y += 16;
  }

  // Grid de N columnas con alto de fila dinámico (evita traslapes si un valor es largo)
  function filasCampos(campos, numCols) {
    const GAP = 16;
    const colAncho = (anchoCaja - 16 - GAP * (numCols - 1)) / numCols;
    for (let i = 0; i < campos.length; i += numCols) {
      const inicio = y;
      let alturaMax = 0;
      for (let c = 0; c < numCols; c++) {
        const campo = campos[i + c];
        if (!campo) continue;
        const [etiqueta, valor] = campo;
        const x = xCaja + 8 + c * (colAncho + GAP);
        doc.fillColor(INK_SOFT).font('Helvetica').fontSize(8).text(etiqueta, x, inicio, { width: colAncho });
        const texto = valor === undefined || valor === null || valor === '' ? '—' : String(valor);
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.8);
        doc.text(texto, x, inicio + 10, { width: colAncho });
        alturaMax = Math.max(alturaMax, 10 + doc.heightOfString(texto, { width: colAncho, font: 'Helvetica-Bold', fontSize: 8.8 }));
      }
      y = inicio + alturaMax + 8;
    }
  }

  function medirFilas(campos, numCols) {
    const GAP = 16;
    const colAncho = (anchoCaja - 16 - GAP * (numCols - 1)) / numCols;
    let total = 0;
    for (let i = 0; i < campos.length; i += numCols) {
      let alturaMax = 0;
      for (let c = 0; c < numCols; c++) {
        const campo = campos[i + c];
        if (!campo) continue;
        const texto = campo[1] === undefined || campo[1] === null || campo[1] === '' ? '—' : String(campo[1]);
        alturaMax = Math.max(alturaMax, 10 + doc.heightOfString(texto, { width: colAncho, font: 'Helvetica-Bold', fontSize: 8.8 }));
      }
      total += alturaMax + 8;
    }
    return total;
  }

  // --- Datos Generales ---
  const edad = calcularEdad(s.fecha_nacimiento);
  const camposGenerales = [
    ['Nombre completo:', s.nombre_completo],
    ['Fecha nacimiento:', formatearFecha(s.fecha_nacimiento) + (edad != null ? `  (${edad} años)` : '')],
    ['Identidad (DNI):', s.dni],
    ['Estado civil:', s.estado_civil],
    ['Profesión:', s.profesion],
    [s.nombre_esposa ? 'Nombre de la esposa:' : 'Hijos:', s.nombre_esposa || s.hijos_cantidad],
    ['Celular:', s.celular],
    ['Contacto de emergencia:', s.contacto_emergencia_telefono],
  ];
  bannerCaja('DATOS GENERALES', 16 + 6 + medirFilas(camposGenerales, 3) + 4);
  y += 6;
  filasCampos(camposGenerales, 3);
  y += 2;

  // --- Datos Organizacionales ---
  const camposOrg = [
    ['Capítulo inscrito:', s.capitulo],
    ['Zona:', s.zona],
    ['Fecha inscripción capítulo:', formatearFecha(s.fecha_inscripcion_capitulo)],
    ['Cargo actual:', s.cargo_actual],
    ['Tiempo en FIHNEC:', s.tiempo_fihnec],
    ['E-mail:', s.email],
  ];
  const cargos = s.cargos_desempenados && s.cargos_desempenados.length ? s.cargos_desempenados : null;
  const filasCargos = cargos ? Math.ceil(cargos.length / 3) : 1;
  bannerCaja('DATOS ORGANIZACIONALES', 16 + 6 + medirFilas(camposOrg, 3) + 4 + 13 + filasCargos * 12 + 8);
  y += 6;
  filasCampos(camposOrg, 3);
  y += 2;

  doc.fillColor(INK_SOFT).font('Helvetica').fontSize(8).text('Cargos desempeñados (histórico):', xCaja + 8, y, { width: anchoCaja - 16 });
  y += 13;
  if (cargos) {
    const colCargoAncho = (anchoCaja - 16 - 16 * 2) / 3;
    for (let i = 0; i < cargos.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        if (!cargos[i + c]) continue;
        const x = xCaja + 8 + c * (colCargoAncho + 16);
        casilla(x, y + 1, true);
        doc.fillColor(INK).font('Helvetica').fontSize(7.8).text(cargos[i + c], x + 13, y, { width: colCargoAncho - 13 });
      }
      y += 12;
    }
  } else {
    casilla(xCaja + 8, y + 1, false);
    doc.fillColor(INK_SOFT).font('Helvetica').fontSize(8.2).text('Sin cargos registrados', xCaja + 21, y);
    y += 12;
  }
  y += 10;

  // ---------- Franjas horizontales tipo checklist (todas las opciones visibles) ----------
  function franjaChecklist(titulo, opciones, seleccionadas) {
    const seleccion = new Set(seleccionadas || []);
    doc.rect(MARGEN, y, ANCHO_UTIL, 14).fill(BANNER_BG);
    doc.rect(MARGEN, y, ANCHO_UTIL, 14).lineWidth(1).strokeColor(NIGHT).stroke();
    doc.fillColor(NIGHT).font('Helvetica-Bold').fontSize(8.5).text(titulo, MARGEN, y + 3, { width: ANCHO_UTIL, align: 'center', characterSpacing: 0.5 });
    y += 14;
    const colAncho2 = ANCHO_UTIL / opciones.length;
    const alturaEtiquetas = 22;
    doc.rect(MARGEN, y, ANCHO_UTIL, alturaEtiquetas + 16).lineWidth(1).strokeColor(NIGHT).stroke();
    opciones.forEach((op, i) => {
      const x = MARGEN + i * colAncho2;
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + alturaEtiquetas + 16).lineWidth(0.5).strokeColor(LINEA).stroke();
      doc.fillColor(INK_SOFT).font('Helvetica').fontSize(6.8).text(op, x + 3, y + 3, { width: colAncho2 - 6, align: 'center' });
      casilla(x + colAncho2 / 2 - 4, y + alturaEtiquetas, seleccion.has(op), 9);
    });
    y += alturaEtiquetas + 16 + 10;
  }

  franjaChecklist('TIPO DE TESTIMONIO', TIPOS_TESTIMONIO_LISTA, [s.tipo_testimonio]);
  franjaChecklist('FORMACIÓN OFICIAL', FORMACION_OFICIAL_LISTA, s.formacion_oficial);
  franjaChecklist('OTRAS PARTICIPACIONES', OTRAS_PARTICIPACIONES_LISTA, s.otras_participaciones);

  // ---------- Pie de página ----------
  const yPie = ALTO_PAG - 22;
  doc.moveTo(MARGEN, yPie).lineTo(ANCHO - MARGEN, yPie).lineWidth(0.5).strokeColor(LINEA).stroke();
  doc.fillColor(INK_SOFT).font('Helvetica').fontSize(7.5).text(`Generado el ${formatearFecha(new Date())} · Sistema SFL FIHNEC`, MARGEN, yPie + 5);

  doc.end();
});

router.delete('/:id', requireModulo('servidores', 'edicion'), async (req, res) => {
  const { rows } = await query('SELECT nombre_completo FROM servidores WHERE id = $1', [req.params.id]);
  if (rows[0]) await guardarEnPapelera('servidores', req.params.id, rows[0].nombre_completo, req.user.id);
  const { rowCount } = await query('DELETE FROM servidores WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Servidor no encontrado.' });
  res.json({ mensaje: 'Servidor eliminado.' });
});

export default router;
