import { Router } from 'express';
import { utils, write } from 'xlsx';
import { query } from '../db.js';
import { requireAuth, requireSuperAdmin } from '../auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireSuperAdmin); // solo super_admin puede ver/descargar respaldos

async function obtenerTablas() {
  const [eventos, participantes, inscripciones, servidores, configuracion, usuariosAdmin] = await Promise.all([
    query('SELECT * FROM eventos ORDER BY orden'),
    query('SELECT * FROM participantes ORDER BY id'),
    query('SELECT * FROM inscripciones ORDER BY id'),
    query('SELECT * FROM servidores ORDER BY id'),
    query('SELECT * FROM configuracion ORDER BY clave'),
    // Nunca se incluye password_hash en ningún respaldo, ni JSON ni Excel.
    query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios_admin ORDER BY id')
  ]);
  return {
    eventos: eventos.rows,
    participantes: participantes.rows,
    inscripciones: inscripciones.rows,
    servidores: servidores.rows,
    configuracion: configuracion.rows,
    usuarios_admin: usuariosAdmin.rows
  };
}

// GET /api/admin/mantenimiento/respaldo -> descarga un .json con TODA la base de datos
router.get('/respaldo', async (req, res) => {
  const tablas = await obtenerTablas();
  const respaldo = {
    generado_en: new Date().toISOString(),
    generado_por: req.user.email,
    tablas,
    conteos: Object.fromEntries(Object.entries(tablas).map(([nombre, filas]) => [nombre, filas.length]))
  };

  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="respaldo_sfl_${fecha}.json"`);
  res.send(JSON.stringify(respaldo, null, 2));
});

// GET /api/admin/mantenimiento/respaldo-excel -> descarga un .xlsx con una hoja por tabla
router.get('/respaldo-excel', async (req, res) => {
  const tablas = await obtenerTablas();
  const libro = utils.book_new();

  // Nombres de hoja de Excel tienen un límite de 31 caracteres y no aceptan ciertos símbolos.
  const NOMBRES_HOJA = {
    eventos: 'Eventos',
    participantes: 'Participantes',
    inscripciones: 'Inscripciones',
    servidores: 'Servidores',
    configuracion: 'Configuracion',
    usuarios_admin: 'Usuarios'
  };

  for (const [tabla, filas] of Object.entries(tablas)) {
    // Las columnas tipo arreglo (ej. cargos_desempenados en servidores) se convierten a texto
    // separado por comas, porque Excel no tiene un tipo de dato "lista".
    const filasParaExcel = filas.map(fila => {
      const plano = {};
      for (const [clave, valor] of Object.entries(fila)) {
        plano[clave] = Array.isArray(valor) ? valor.join(', ') : valor;
      }
      return plano;
    });
    const hoja = utils.json_to_sheet(filasParaExcel);
    utils.book_append_sheet(libro, hoja, NOMBRES_HOJA[tabla] || tabla);
  }

  const buffer = write(libro, { type: 'buffer', bookType: 'xlsx' });
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="respaldo_sfl_${fecha}.xlsx"`);
  res.send(buffer);
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
