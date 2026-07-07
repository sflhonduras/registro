import { Router } from 'express';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import xlsx from 'xlsx';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { normalizarNombre } from '../texto.js';

const router = Router();
router.use(requireAuth); // todas las rutas de admin requieren sesión
router.use((req, res, next) => {
  if (req.user.rol === 'cocina') return res.status(403).json({ error: 'No tienes acceso a esta sección.' });
  next();
});

/* ---------------------------- PARTICIPANTES ---------------------------- */

// GET /api/admin/participantes?buscar=&pagina=&limite=&evento=
router.get('/participantes', async (req, res) => {
  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
  const offset = (pagina - 1) * limite;
  const buscar = (req.query.buscar || '').trim();
  const eventoOrden = req.query.evento ? parseInt(req.query.evento, 10) : null;
  const soloCicloActual = req.query.solo_ciclo_actual === 'true';

  const params = [];
  let where = '1=1';
  if (buscar) {
    params.push(`%${buscar}%`);
    where += ` AND (p.nombre_completo ILIKE $${params.length} OR p.dni ILIKE $${params.length} OR p.capitulo ILIKE $${params.length})`;
  }
  let joinEvento = '';
  let ordenPor = 'p.id ASC';
  let indiceParamEvento = null;
  if (eventoOrden) {
    params.push(eventoOrden);
    indiceParamEvento = params.length;
    const filtroCiclo = soloCicloActual ? ' AND i.ciclo = e.ciclo_actual' : '';
    joinEvento = `AND EXISTS (SELECT 1 FROM inscripciones i JOIN eventos e ON e.id=i.evento_id WHERE i.participante_id=p.id AND e.orden=$${indiceParamEvento}${filtroCiclo})`;
    if (soloCicloActual) {
      ordenPor = `(SELECT i.registrado_en FROM inscripciones i JOIN eventos e ON e.id=i.evento_id WHERE i.participante_id=p.id AND e.orden=$${indiceParamEvento}) DESC`;
    }
  }

  const totalRes = await query(`SELECT COUNT(*)::int AS total FROM participantes p WHERE ${where} ${joinEvento}`, params);
  params.push(limite, offset);
  const campoPresencial = indiceParamEvento
    ? `(SELECT i.registrado_presencial FROM inscripciones i JOIN eventos e ON e.id=i.evento_id WHERE i.participante_id=p.id AND e.orden=$${indiceParamEvento}) AS registrado_presencial`
    : 'NULL AS registrado_presencial';
  const dataRes = await query(
    `SELECT p.*, ${campoPresencial},
       (SELECT array_agg(e.orden ORDER BY e.orden) FROM inscripciones i JOIN eventos e ON e.id = i.evento_id WHERE i.participante_id = p.id) AS eventos_inscritos
     FROM participantes p
     WHERE ${where} ${joinEvento}
     ORDER BY ${ordenPor}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ total: totalRes.rows[0].total, pagina, limite, datos: dataRes.rows });
});

router.get('/participantes/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM participantes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Participante no encontrado.' });
  const insc = await query(
    `SELECT e.orden, e.nombre, e.fecha_evento, e.fecha_evento_fin, i.registrado_en, i.fecha_graduacion, i.promocion_graduacion, i.origen FROM inscripciones i
     JOIN eventos e ON e.id = i.evento_id WHERE i.participante_id = $1 ORDER BY e.orden`,
    [req.params.id]
  );
  const promocionRes = await query("SELECT valor FROM configuracion WHERE clave = 'promocion_actual'");
  res.json({ ...rows[0], inscripciones: insc.rows, promocion_actual: promocionRes.rows[0]?.valor || null });
});

const CAMPOS_PARTICIPANTE = [
  'nombre_completo', 'dni', 'celular', 'capitulo', 'zona', 'departamento', 'municipio',
  'cargo_fihnec', 'estado_civil', 'hijos_cantidad', 'comparte_testimonio', 'tiempo_comparte_testimonio',
  'ha_recibido_sael', 'cantidad_saeles', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono',
  'pin', 'observacion'
];

// POST /api/admin/participantes  (crear manualmente) - solo admin
router.post('/participantes', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (!b.nombre_completo || !b.dni) return res.status(400).json({ error: 'Nombre y DNI son obligatorios.' });
  if (b.nombre_completo) b.nombre_completo = normalizarNombre(b.nombre_completo);
  if (b.contacto_emergencia_nombre) b.contacto_emergencia_nombre = normalizarNombre(b.contacto_emergencia_nombre);
  if (b.capitulo) b.capitulo = normalizarNombre(b.capitulo);
  const cols = CAMPOS_PARTICIPANTE.filter(c => b[c] !== undefined);
  const vals = cols.map(c => b[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  try {
    const { rows } = await query(
      `INSERT INTO participantes (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un participante con ese DNI.' });
    throw e;
  }
});

// PUT /api/admin/participantes/:id - solo admin
router.put('/participantes/:id', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (b.nombre_completo) b.nombre_completo = normalizarNombre(b.nombre_completo);
  if (b.contacto_emergencia_nombre) b.contacto_emergencia_nombre = normalizarNombre(b.contacto_emergencia_nombre);
  if (b.capitulo) b.capitulo = normalizarNombre(b.capitulo);
  const cols = CAMPOS_PARTICIPANTE.filter(c => b[c] !== undefined);
  if (cols.length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const vals = cols.map(c => b[c]);
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE participantes SET ${setClause}, actualizado_en = now() WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Participante no encontrado.' });
  res.json(rows[0]);
});

// DELETE /api/admin/participantes/:id - solo admin
// PUT /api/admin/participantes/:id/inscripciones/:orden/presencial - marcar asistencia presencial
router.put('/participantes/:id/inscripciones/:orden/presencial', requireRole('admin'), async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const { registrado_presencial } = req.body || {};
  const { rowCount } = await query(
    `UPDATE inscripciones SET registrado_presencial = $1
     WHERE participante_id = $2 AND evento_id = (SELECT id FROM eventos WHERE orden = $3)`,
    [!!registrado_presencial, req.params.id, orden]
  );
  if (!rowCount) return res.status(404).json({ error: 'Inscripción no encontrada.' });
  res.json({ mensaje: 'Actualizado.' });
});

router.delete('/participantes/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM participantes WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Participante no encontrado.' });
  res.json({ mensaje: 'Participante eliminado.' });
});

// POST /api/admin/participantes/:id/inscripciones/:orden - inscribir manualmente (admin) a un evento
router.post('/participantes/:id/inscripciones/:orden', requireRole('admin'), async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT id, ciclo_actual FROM eventos WHERE orden = $1', [orden]);
  if (!evRes.rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
  try {
    await query(
      'INSERT INTO inscripciones (participante_id, evento_id, origen, ciclo) VALUES ($1,$2,$3,$4)',
      [req.params.id, evRes.rows[0].id, 'admin', evRes.rows[0].ciclo_actual]
    );
    res.status(201).json({ mensaje: 'Inscripción agregada.' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya estaba inscrito en ese evento.' });
    throw e;
  }
});

// DELETE /api/admin/participantes/:id/inscripciones/:orden - quitar inscripción (admin)
router.delete('/participantes/:id/inscripciones/:orden', requireRole('admin'), async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  await query(
    `DELETE FROM inscripciones WHERE participante_id = $1 AND evento_id = (SELECT id FROM eventos WHERE orden = $2)`,
    [req.params.id, orden]
  );
  res.json({ mensaje: 'Inscripción eliminada.' });
});

/* ------------------------------- EVENTOS -------------------------------- */

router.get('/eventos', async (req, res) => {
  const { rows } = await query('SELECT * FROM eventos ORDER BY orden');
  res.json(rows);
});

router.put('/eventos/:orden', requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  const campos = ['nombre', 'descripcion', 'fecha_evento', 'fecha_evento_fin', 'hora_evento', 'lugar', 'fecha_limite_registro', 'activo', 'cupo_maximo'];
  const cols = campos.filter(c => b[c] !== undefined);
  if (cols.length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const vals = cols.map(c => b[c]);
  vals.push(req.params.orden);
  const { rows } = await query(
    `UPDATE eventos SET ${setClause}, actualizado_en = now() WHERE orden = $${vals.length} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
  res.json(rows[0]);
});

// POST /api/admin/eventos/:orden/nuevo-ciclo
// Marca un nuevo ciclo/edición de este nivel. Las inscripciones anteriores quedan intactas
// en el historial, pero dejan de contarse como "del evento actual" en estadísticas y diplomas.
router.post('/eventos/:orden/nuevo-ciclo', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    'UPDATE eventos SET ciclo_actual = ciclo_actual + 1, actualizado_en = now() WHERE orden = $1 RETURNING *',
    [req.params.orden]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
  res.json({ mensaje: `Nuevo ciclo iniciado (ciclo #${rows[0].ciclo_actual}). Los contadores de este nivel arrancan de cero.`, evento: rows[0] });
});

// POST /api/admin/eventos/:orden/marcar-actual
// Marca este nivel como "el evento actual" (el único que se muestra en el contador principal
// del panel). Desmarca automáticamente cualquier otro nivel que lo tuviera antes.
router.post('/eventos/:orden/marcar-actual', requireRole('admin'), async (req, res) => {
  await query('UPDATE eventos SET es_actual = FALSE');
  const { rows } = await query(
    'UPDATE eventos SET es_actual = TRUE WHERE orden = $1 RETURNING *',
    [req.params.orden]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
  res.json({ mensaje: `"${rows[0].nombre}" ahora es el evento actual.`, evento: rows[0] });
});

// POST /api/admin/promocion/avanzar -> avanza la promoción actual en +1 (ej. de V a VI)
router.post('/promocion/avanzar', requireRole('admin'), async (req, res) => {
  const actual = await query("SELECT valor FROM configuracion WHERE clave = 'promocion_actual'");
  const nuevoValor = (parseInt(actual.rows[0]?.valor || '0', 10) + 1);
  await query(
    `INSERT INTO configuracion (clave, valor, actualizado_en) VALUES ('promocion_actual', $1, now())
     ON CONFLICT (clave) DO UPDATE SET valor = $1, actualizado_en = now()`,
    [String(nuevoValor)]
  );
  res.json({ mensaje: `Ahora se está cursando la Promoción ${nuevoValor}.`, promocion_actual: nuevoValor });
});

/* ------------------------------- ESTADÍSTICAS ---------------------------- */

router.get('/estadisticas', async (req, res) => {
  const porEvento = await query(`
    SELECT e.orden, e.codigo, e.nombre, e.ciclo_actual, e.es_actual,
      COUNT(i.id)::int AS total_inscritos,
      COUNT(i.id) FILTER (WHERE i.ciclo = e.ciclo_actual)::int AS total_ciclo_actual
    FROM eventos e LEFT JOIN inscripciones i ON i.evento_id = e.id
    GROUP BY e.id ORDER BY e.orden`);

  const porZona = await query(`
    SELECT COALESCE(zona,'Sin zona') AS zona, COUNT(*)::int AS total
    FROM participantes GROUP BY zona ORDER BY total DESC`);

  const porDepartamento = await query(`
    SELECT COALESCE(departamento,'Sin depto.') AS departamento, COUNT(*)::int AS total
    FROM participantes GROUP BY departamento ORDER BY total DESC`);

  const porCapitulo = await query(`
    SELECT COALESCE(capitulo,'Sin capítulo') AS capitulo, COUNT(*)::int AS total
    FROM participantes GROUP BY capitulo ORDER BY total DESC LIMIT 15`);

  const porDia = await query(`
    SELECT to_char(registrado_en, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS total
    FROM inscripciones GROUP BY dia ORDER BY dia`);

  const porMunicipio = await query(`
    SELECT COALESCE(departamento,'Sin depto.') AS departamento, COALESCE(municipio,'Sin municipio') AS municipio, COUNT(*)::int AS total
    FROM participantes GROUP BY departamento, municipio ORDER BY departamento, total DESC`);

  const embudo = await query(`
    SELECT e.orden, e.nombre, COUNT(i.id)::int AS total
    FROM eventos e LEFT JOIN inscripciones i ON i.evento_id = e.id
    GROUP BY e.id ORDER BY e.orden`);

  const totalParticipantes = await query('SELECT COUNT(*)::int AS total FROM participantes');
  const totalCicloActual = porEvento.rows.reduce((suma, e) => suma + e.total_ciclo_actual, 0);
  const eventoActual = porEvento.rows.find(e => e.es_actual) || null;
  const promocionRes = await query("SELECT valor FROM configuracion WHERE clave = 'promocion_actual'");
  const promocionActual = promocionRes.rows[0] ? parseInt(promocionRes.rows[0].valor, 10) : null;

  // Agrupa municipios bajo cada departamento (para el mapa de Honduras)
  const mapaDepartamentos = {};
  for (const fila of porMunicipio.rows) {
    if (!mapaDepartamentos[fila.departamento]) mapaDepartamentos[fila.departamento] = { departamento: fila.departamento, total: 0, municipios: [] };
    mapaDepartamentos[fila.departamento].total += fila.total;
    mapaDepartamentos[fila.departamento].municipios.push({ municipio: fila.municipio, total: fila.total });
  }

  res.json({
    total_participantes: totalParticipantes.rows[0].total,
    total_ciclo_actual: totalCicloActual,
    evento_actual: eventoActual,
    promocion_actual: promocionActual,
    por_evento: porEvento.rows,
    por_zona: porZona.rows,
    por_departamento: porDepartamento.rows,
    por_capitulo: porCapitulo.rows,
    inscripciones_por_dia: porDia.rows,
    mapa_departamentos: Object.values(mapaDepartamentos),
    embudo: embudo.rows
  });
});

// GET /api/admin/estadisticas/excel -> descarga un libro de Excel con varias hojas
router.get('/estadisticas/excel', async (req, res) => {
  const porEvento = await query(`
    SELECT e.orden AS "Nivel", e.nombre AS "Nombre", e.ciclo_actual AS "Ciclo actual",
      COUNT(i.id)::int AS "Total histórico",
      COUNT(i.id) FILTER (WHERE i.ciclo = e.ciclo_actual)::int AS "Total ciclo actual"
    FROM eventos e LEFT JOIN inscripciones i ON i.evento_id = e.id
    GROUP BY e.id ORDER BY e.orden`);
  const porZona = await query(`
    SELECT COALESCE(zona,'Sin zona') AS "Zona", COUNT(*)::int AS "Total"
    FROM participantes GROUP BY zona ORDER BY "Total" DESC`);
  const porDepartamento = await query(`
    SELECT COALESCE(departamento,'Sin depto.') AS "Departamento", COUNT(*)::int AS "Total"
    FROM participantes GROUP BY departamento ORDER BY "Total" DESC`);
  const porCapitulo = await query(`
    SELECT COALESCE(capitulo,'Sin capítulo') AS "Capítulo", COUNT(*)::int AS "Total"
    FROM participantes GROUP BY capitulo ORDER BY "Total" DESC`);
  const porDia = await query(`
    SELECT to_char(registrado_en, 'YYYY-MM-DD') AS "Fecha", COUNT(*)::int AS "Inscripciones"
    FROM inscripciones GROUP BY "Fecha" ORDER BY "Fecha"`);

  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(porEvento.rows), 'Por Nivel');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(porZona.rows), 'Por Zona');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(porDepartamento.rows), 'Por Departamento');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(porCapitulo.rows), 'Por Capítulo');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(porDia.rows), 'Inscripciones por Día');
  const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="estadisticas_sfl.xlsx"');
  res.send(buffer);
});

/* ---------------------------- USUARIOS ADMIN ----------------------------- */

router.get('/usuarios', requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios_admin ORDER BY id');
  res.json(rows);
});

router.post('/usuarios', requireRole('admin'), async (req, res) => {
  const { nombre, email, password, rol } = req.body || {};
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  if (!['admin', 'consulta', 'cocina'].includes(rol)) return res.status(400).json({ error: 'Rol inválido.' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      'INSERT INTO usuarios_admin (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol, activo',
      [nombre, email.toLowerCase().trim(), hash, rol]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
    throw e;
  }
});

router.put('/usuarios/:id', requireRole('admin'), async (req, res) => {
  const { nombre, rol, activo, password } = req.body || {};
  const sets = [];
  const vals = [];
  if (nombre !== undefined) { vals.push(nombre); sets.push(`nombre = $${vals.length}`); }
  if (rol !== undefined) { vals.push(rol); sets.push(`rol = $${vals.length}`); }
  if (activo !== undefined) { vals.push(activo); sets.push(`activo = $${vals.length}`); }
  if (password) { vals.push(await bcrypt.hash(password, 10)); sets.push(`password_hash = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar.' });
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE usuarios_admin SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, nombre, email, rol, activo`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(rows[0]);
});

router.delete('/usuarios/:id', requireRole('admin'), async (req, res) => {
  if (String(req.user.id) === req.params.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  const { rowCount } = await query('DELETE FROM usuarios_admin WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ mensaje: 'Usuario eliminado.' });
});

// PUT /api/admin/participantes/:id/inscripciones/:orden/graduacion - fijar/quitar fecha de graduación
router.put('/participantes/:id/inscripciones/:orden/graduacion', requireRole('admin'), async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const { fecha_graduacion, promocion_graduacion } = req.body || {};
  const { rowCount } = await query(
    `UPDATE inscripciones SET fecha_graduacion = $1, promocion_graduacion = $2
     WHERE participante_id = $3 AND evento_id = (SELECT id FROM eventos WHERE orden = $4)`,
    [fecha_graduacion || null, promocion_graduacion || null, req.params.id, orden]
  );
  if (!rowCount) return res.status(404).json({ error: 'Inscripción no encontrada.' });
  res.json({ mensaje: 'Datos de graduación guardados.' });
});

/* -------------------------------- DIPLOMAS -------------------------------- */

// GET /api/admin/diplomas/:orden -> lista de participantes registrados en ese nivel
router.get('/diplomas/:orden', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  const evento = evRes.rows[0];
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { rows } = await query(
    `SELECT p.nombre_completo, p.capitulo, p.cargo_fihnec, i.registrado_en, i.fecha_graduacion
     FROM inscripciones i
     JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo = $2
     ORDER BY p.nombre_completo ASC`,
    [evento.id, evento.ciclo_actual]
  );
  res.json({ evento, total: rows.length, participantes: rows });
});

// GET /api/admin/diplomas/:orden/excel -> descarga .xlsx con Numero, Nombre, Capítulo, Cargo
router.get('/diplomas/:orden/excel', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  const evento = evRes.rows[0];
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { rows } = await query(
    `SELECT p.nombre_completo, p.capitulo, p.cargo_fihnec
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo = $2 ORDER BY p.nombre_completo ASC`,
    [evento.id, evento.ciclo_actual]
  );

  const datos = rows.map((r, i) => ({
    '#': i + 1,
    'Nombre Completo': r.nombre_completo,
    'Capítulo': r.capitulo || '',
    'Cargo': r.cargo_fihnec || ''
  }));

  const hoja = xlsx.utils.json_to_sheet(datos);
  hoja['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 26 }, { wch: 30 }];
  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, hoja, `Diplomas ${evento.codigo}`);
  const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="diplomas_${evento.codigo}.xlsx"`);
  res.send(buffer);
});

// GET /api/admin/diplomas/:orden/pdf -> descarga PDF con la misma lista
router.get('/diplomas/:orden/pdf', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  const evento = evRes.rows[0];
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { rows } = await query(
    `SELECT p.nombre_completo, p.capitulo, p.cargo_fihnec
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo = $2 ORDER BY p.nombre_completo ASC`,
    [evento.id, evento.ciclo_actual]
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="diplomas_${evento.codigo}.pdf"`);

  const doc = new PDFDocument({ size: 'letter', margin: 40, layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text('FIHNEC · Seminario para la Formación de Líderes', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(evento.nombre, { align: 'center' });
  doc.moveDown(1);

  const colX = [50, 100, 420, 620];
  const colW = [50, 300, 190, 170];
  const y0 = doc.y;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('#', colX[0], y0, { width: colW[0] });
  doc.text('Nombre Completo', colX[1], y0, { width: colW[1] });
  doc.text('Capítulo', colX[2], y0, { width: colW[2] });
  doc.text('Cargo', colX[3], y0, { width: colW[3] });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(762, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(10);
  rows.forEach((r, i) => {
    if (doc.y > 500) { doc.addPage({ size: 'letter', margin: 40, layout: 'landscape' }); doc.y = 40; }
    const y = doc.y;
    doc.text(String(i + 1), colX[0], y, { width: colW[0] });
    doc.text(r.nombre_completo, colX[1], y, { width: colW[1] });
    doc.text(r.capitulo || '—', colX[2], y, { width: colW[2] });
    doc.text(r.cargo_fihnec || '—', colX[3], y, { width: colW[3] });
    doc.moveDown(0.6);
  });

  doc.end();
});

/* ---------------------- EXPORTAR LISTA PARA LLAMADAS ---------------------- */

// GET /api/admin/exportar-contacto/:orden?ciclo_actual=true|false&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Descarga .xlsx con Nombre Completo, Capítulo, Teléfono, Zona, Cargo de quienes se
// registraron a ese nivel, ya sea en el ciclo actual o en un rango de fechas elegido.
router.get('/exportar-contacto/:orden', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  const evento = evRes.rows[0];
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { ciclo_actual, desde, hasta } = req.query;
  let filtroFecha = '';
  const params = [evento.id];

  if (ciclo_actual === 'true') {
    params.push(evento.ciclo_actual);
    filtroFecha = `AND i.ciclo = $${params.length}`;
  } else if (desde && hasta) {
    params.push(desde, `${hasta} 23:59:59`);
    filtroFecha = `AND i.registrado_en BETWEEN $${params.length - 1} AND $${params.length}`;
  }

  const { rows } = await query(
    `SELECT p.nombre_completo, p.capitulo, p.celular, p.zona, p.cargo_fihnec
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 ${filtroFecha}
     ORDER BY p.nombre_completo ASC`,
    params
  );

  const datos = rows.map(r => ({
    'Nombre Completo': r.nombre_completo,
    'Capítulo': r.capitulo || '',
    'Teléfono': r.celular || '',
    'Zona': r.zona || '',
    'Cargo': r.cargo_fihnec || ''
  }));

  const hoja = xlsx.utils.json_to_sheet(datos);
  hoja['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 30 }];
  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, hoja, `Nivel ${orden}`);
  const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="contactos_nivel_${orden}.xlsx"`);
  res.send(buffer);
});

/* ------------------------------ EXPORTAR CSV ------------------------------ */


router.get('/exportar/participantes.csv', async (req, res) => {
  const { rows } = await query(`
    SELECT p.*,
      (SELECT string_agg(e.codigo, ',' ORDER BY e.orden) FROM inscripciones i JOIN eventos e ON e.id=i.evento_id WHERE i.participante_id=p.id) AS eventos_inscritos
    FROM participantes p ORDER BY p.id`);
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = v => v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="participantes_sfl.csv"');
  res.send('\uFEFF' + csv);
});

export default router;
