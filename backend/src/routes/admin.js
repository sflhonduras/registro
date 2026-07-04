import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth); // todas las rutas de admin requieren sesión

/* ---------------------------- PARTICIPANTES ---------------------------- */

// GET /api/admin/participantes?buscar=&pagina=&limite=&evento=
router.get('/participantes', async (req, res) => {
  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
  const offset = (pagina - 1) * limite;
  const buscar = (req.query.buscar || '').trim();
  const eventoOrden = req.query.evento ? parseInt(req.query.evento, 10) : null;

  const params = [];
  let where = '1=1';
  if (buscar) {
    params.push(`%${buscar}%`);
    where += ` AND (p.nombre_completo ILIKE $${params.length} OR p.dni ILIKE $${params.length} OR p.capitulo ILIKE $${params.length})`;
  }
  let joinEvento = '';
  if (eventoOrden) {
    params.push(eventoOrden);
    joinEvento = `AND EXISTS (SELECT 1 FROM inscripciones i JOIN eventos e ON e.id=i.evento_id WHERE i.participante_id=p.id AND e.orden=$${params.length})`;
  }

  const totalRes = await query(`SELECT COUNT(*)::int AS total FROM participantes p WHERE ${where} ${joinEvento}`, params);
  params.push(limite, offset);
  const dataRes = await query(
    `SELECT p.*,
       (SELECT array_agg(e.orden ORDER BY e.orden) FROM inscripciones i JOIN eventos e ON e.id = i.evento_id WHERE i.participante_id = p.id) AS eventos_inscritos
     FROM participantes p
     WHERE ${where} ${joinEvento}
     ORDER BY p.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ total: totalRes.rows[0].total, pagina, limite, datos: dataRes.rows });
});

router.get('/participantes/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM participantes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Participante no encontrado.' });
  const insc = await query(
    `SELECT e.orden, e.nombre, i.registrado_en, i.origen FROM inscripciones i
     JOIN eventos e ON e.id = i.evento_id WHERE i.participante_id = $1 ORDER BY e.orden`,
    [req.params.id]
  );
  res.json({ ...rows[0], inscripciones: insc.rows });
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
router.delete('/participantes/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM participantes WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Participante no encontrado.' });
  res.json({ mensaje: 'Participante eliminado.' });
});

// POST /api/admin/participantes/:id/inscripciones/:orden - inscribir manualmente (admin) a un evento
router.post('/participantes/:id/inscripciones/:orden', requireRole('admin'), async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const evRes = await query('SELECT id FROM eventos WHERE orden = $1', [orden]);
  if (!evRes.rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
  try {
    await query(
      'INSERT INTO inscripciones (participante_id, evento_id, origen) VALUES ($1,$2,$3)',
      [req.params.id, evRes.rows[0].id, 'admin']
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
  const campos = ['nombre', 'descripcion', 'fecha_evento', 'hora_evento', 'lugar', 'fecha_limite_registro', 'activo', 'cupo_maximo'];
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

/* ------------------------------- ESTADÍSTICAS ---------------------------- */

router.get('/estadisticas', async (req, res) => {
  const porEvento = await query(`
    SELECT e.orden, e.codigo, e.nombre, COUNT(i.id)::int AS total_inscritos
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

  const embudo = await query(`
    SELECT e.orden, e.nombre, COUNT(i.id)::int AS total
    FROM eventos e LEFT JOIN inscripciones i ON i.evento_id = e.id
    GROUP BY e.id ORDER BY e.orden`);

  const totalParticipantes = await query('SELECT COUNT(*)::int AS total FROM participantes');

  res.json({
    total_participantes: totalParticipantes.rows[0].total,
    por_evento: porEvento.rows,
    por_zona: porZona.rows,
    por_departamento: porDepartamento.rows,
    por_capitulo: porCapitulo.rows,
    inscripciones_por_dia: porDia.rows,
    embudo: embudo.rows
  });
});

/* ---------------------------- USUARIOS ADMIN ----------------------------- */

router.get('/usuarios', requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios_admin ORDER BY id');
  res.json(rows);
});

router.post('/usuarios', requireRole('admin'), async (req, res) => {
  const { nombre, email, password, rol } = req.body || {};
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  if (!['admin', 'consulta'].includes(rol)) return res.status(400).json({ error: 'Rol inválido.' });
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
