import { Router } from 'express';
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
