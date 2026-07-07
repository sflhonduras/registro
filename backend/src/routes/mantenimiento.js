import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin')); // solo admin puede ver/descargar respaldos

// GET /api/admin/mantenimiento/respaldo -> descarga un .json con TODA la base de datos
// No incluye password_hash de usuarios_admin por seguridad (no debería salir de la app
// ni en un archivo que luego se sube a Google Drive).
router.get('/respaldo', async (req, res) => {
  const [eventos, participantes, inscripciones, servidores, configuracion, usuariosAdmin] = await Promise.all([
    query('SELECT * FROM eventos ORDER BY orden'),
    query('SELECT * FROM participantes ORDER BY id'),
    query('SELECT * FROM inscripciones ORDER BY id'),
    query('SELECT * FROM servidores ORDER BY id'),
    query('SELECT * FROM configuracion ORDER BY clave'),
    query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios_admin ORDER BY id')
  ]);

  const respaldo = {
    generado_en: new Date().toISOString(),
    generado_por: req.user.email,
    tablas: {
      eventos: eventos.rows,
      participantes: participantes.rows,
      inscripciones: inscripciones.rows,
      servidores: servidores.rows,
      configuracion: configuracion.rows,
      usuarios_admin: usuariosAdmin.rows
    },
    conteos: {
      eventos: eventos.rowCount,
      participantes: participantes.rowCount,
      inscripciones: inscripciones.rowCount,
      servidores: servidores.rowCount,
      configuracion: configuracion.rowCount,
      usuarios_admin: usuariosAdmin.rowCount
    }
  };

  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="respaldo_sfl_${fecha}.json"`);
  res.send(JSON.stringify(respaldo, null, 2));
});

// GET /api/admin/mantenimiento/resumen -> solo los conteos, para mostrar en pantalla sin descargar
router.get('/resumen', async (req, res) => {
  const [eventos, participantes, inscripciones, servidores] = await Promise.all([
    query('SELECT COUNT(*) FROM eventos'),
    query('SELECT COUNT(*) FROM participantes'),
    query('SELECT COUNT(*) FROM inscripciones'),
    query('SELECT COUNT(*) FROM servidores')
  ]);
  res.json({
    eventos: Number(eventos.rows[0].count),
    participantes: Number(participantes.rows[0].count),
    inscripciones: Number(inscripciones.rows[0].count),
    servidores: Number(servidores.rows[0].count)
  });
});

export default router;
