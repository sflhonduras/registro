import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Utilidad: estado de un evento (abierto/cerrado) según fecha límite + flag activo
function estadoEvento(ev) {
  const ahora = new Date();
  const limite = ev.fecha_limite_registro ? new Date(ev.fecha_limite_registro) : null;
  const venciDeCierre = limite ? ahora > limite : false;
  const abierto = ev.activo && !venciDeCierre;
  return { ...ev, abierto, venciDeCierre };
}

// GET /api/eventos -> lista pública de los 4 eventos con su estado
router.get('/eventos', async (req, res) => {
  const { rows } = await query('SELECT * FROM eventos ORDER BY orden ASC');
  res.json(rows.map(estadoEvento));
});

// GET /api/eventos/:orden/estado -> estado puntual de un evento
router.get('/eventos/:orden/estado', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const { rows } = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(estadoEvento(rows[0]));
});

// POST /api/registro/evento1  -> inscripción completa (crea participante + inscripción)
router.post('/registro/evento1', async (req, res) => {
  const b = req.body || {};
  const requeridos = ['nombre_completo', 'dni'];
  for (const campo of requeridos) {
    if (!b[campo] || String(b[campo]).trim() === '') {
      return res.status(400).json({ error: `El campo "${campo}" es obligatorio.` });
    }
  }
  const dni = String(b.dni).trim();

  const evRes = await query('SELECT * FROM eventos WHERE orden = 1');
  const evento = evRes.rows[0];
  const estado = estadoEvento(evento);
  if (!estado.abierto) {
    return res.status(403).json({ error: 'El registro para el Evento 1 está cerrado en este momento.' });
  }

  const existente = await query('SELECT id FROM participantes WHERE dni = $1', [dni]);
  if (existente.rows[0]) {
    return res.status(409).json({
      error: 'Ya existe un registro con este número de identidad. Cada participante se inscribe una única vez en el Evento 1.'
    });
  }

  const insertParticipante = await query(
    `INSERT INTO participantes
      (nombre_completo, dni, celular, capitulo, zona, departamento, municipio, cargo_fihnec,
       estado_civil, hijos_cantidad, comparte_testimonio, tiempo_comparte_testimonio,
       ha_recibido_sael, cantidad_saeles, contacto_emergencia_nombre, contacto_emergencia_telefono, observacion)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      b.nombre_completo, dni, b.celular || null, b.capitulo || null, b.zona || null,
      b.departamento || null, b.municipio || null, b.cargo_fihnec || null, b.estado_civil || null,
      b.hijos_cantidad ? parseInt(b.hijos_cantidad, 10) : null, b.comparte_testimonio || null,
      b.tiempo_comparte_testimonio || null, b.ha_recibido_sael || null,
      b.cantidad_saeles ? parseInt(b.cantidad_saeles, 10) : null,
      b.contacto_emergencia_nombre || null, b.contacto_emergencia_telefono || null, b.observacion || null
    ]
  );
  const participanteId = insertParticipante.rows[0].id;

  await query(
    'INSERT INTO inscripciones (participante_id, evento_id, origen) VALUES ($1,$2,$3)',
    [participanteId, evento.id, 'web']
  );

  res.status(201).json({ mensaje: 'Registro completado. ¡Bienvenido al SFL Nivel I!', participante_id: participanteId });
});

// POST /api/registro/:orden  (orden = 2, 3, 4) -> solo requiere DNI, valida elegibilidad secuencial
router.post('/registro/:orden', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  if (![2, 3, 4].includes(orden)) {
    return res.status(400).json({ error: 'Ruta de registro inválida.' });
  }
  const dni = String((req.body || {}).dni || '').trim();
  if (!dni) return res.status(400).json({ error: 'Debes indicar tu número de identidad (DNI).' });

  const evActualRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden]);
  const evAnteriorRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden - 1]);
  const evActual = evActualRes.rows[0];
  const evAnterior = evAnteriorRes.rows[0];
  if (!evActual || !evAnterior) return res.status(404).json({ error: 'Evento no encontrado.' });

  const estadoActual = estadoEvento(evActual);
  if (!estadoActual.abierto) {
    return res.status(403).json({ error: `El registro para "${evActual.nombre}" está cerrado en este momento.` });
  }

  const partRes = await query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [dni]);
  const participante = partRes.rows[0];
  if (!participante) {
    return res.status(404).json({
      error: 'No encontramos tu número de identidad en la base de datos. Debes inscribirte primero en el SFL Nivel I.',
      habilitado: false
    });
  }

  const inscripcionAnterior = await query(
    'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
    [participante.id, evAnterior.id]
  );
  if (!inscripcionAnterior.rows[0]) {
    return res.status(403).json({
      error: `No estás habilitado para "${evActual.nombre}". Primero debes completar el registro de "${evAnterior.nombre}".`,
      habilitado: false
    });
  }

  const inscripcionActual = await query(
    'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
    [participante.id, evActual.id]
  );
  if (inscripcionActual.rows[0]) {
    return res.status(409).json({
      error: `Ya estás registrado en "${evActual.nombre}".`,
      habilitado: true,
      ya_registrado: true
    });
  }

  await query(
    'INSERT INTO inscripciones (participante_id, evento_id, origen) VALUES ($1,$2,$3)',
    [participante.id, evActual.id, 'web']
  );

  res.status(201).json({
    mensaje: `¡Listo, ${participante.nombre_completo}! Quedaste registrado en "${evActual.nombre}".`,
    habilitado: true
  });
});

// GET /api/consulta/:orden/:dni -> permite validar elegibilidad sin registrar (para UI de "verificar")
router.get('/consulta/:orden/:dni', async (req, res) => {
  const orden = parseInt(req.params.orden, 10);
  const dni = String(req.params.dni).trim();
  const partRes = await query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [dni]);
  const participante = partRes.rows[0];
  if (!participante) return res.json({ existe: false, habilitado: false });

  if (orden === 1) return res.json({ existe: true, habilitado: false, mensaje: 'Ya estás registrado como participante.' });

  const evAnteriorRes = await query('SELECT * FROM eventos WHERE orden = $1', [orden - 1]);
  const evAnterior = evAnteriorRes.rows[0];
  const insc = await query(
    'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
    [participante.id, evAnterior.id]
  );
  res.json({ existe: true, nombre: participante.nombre_completo, habilitado: !!insc.rows[0] });
});

export default router;
