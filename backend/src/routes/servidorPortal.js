import { Router } from 'express';
import { query } from '../db.js';
import { soloDigitos } from '../texto.js';
import { diasDe, obtenerMapaDias, guardarDiasServidor } from '../diasAsistencia.js';

const router = Router();

// Este router es PÚBLICO (no pasa por requireAuth) — cada endpoint vuelve a verificar
// DNI + PIN en cada llamada, exactamente igual que /api/autoconsulta para Participantes.
// No se usa token de sesión a propósito: mantiene el mismo patrón simple que ya existe,
// sin agregar una capa nueva de expiración/refresh que mantener.

async function verificarServidor(dni, pin) {
  const dniLimpio = String(dni || '').trim();
  const pinLimpio = String(pin || '').trim();
  if (!dniLimpio || !pinLimpio) return null;
  const { rows } = await query('SELECT * FROM servidores WHERE dni = $1', [dniLimpio]);
  const s = rows[0];
  if (!s || !s.pin || s.pin !== pinLimpio) return null;
  return s;
}

async function construirPerfil(servidor) {
  const mapaDias = await obtenerMapaDias();
  const { pin, ...datos } = servidor;
  return { ...datos, dias_asistencia: diasDe(mapaDias, servidor.id) };
}

// POST /api/servidor-portal/consultar  body: { dni, pin }
router.post('/consultar', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });
  res.json(await construirPerfil(servidor));
});

// POST /api/servidor-portal/cambiar-pin  body: { dni, pin_actual, pin_nuevo }
router.post('/cambiar-pin', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin_actual);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN actual incorrectos.' });
  const pinNuevo = String(req.body?.pin_nuevo || '').trim();
  if (!/^\d{4}$/.test(pinNuevo)) return res.status(400).json({ error: 'El nuevo PIN debe tener exactamente 4 dígitos.' });
  await query('UPDATE servidores SET pin = $1 WHERE id = $2', [pinNuevo, servidor.id]);
  res.json({ mensaje: 'PIN actualizado correctamente.' });
});

// PUT /api/servidor-portal/mis-datos  body: { dni, pin, celular?, email?, foto? }
// Gestión propia: solo datos de contacto — nunca nombre, DNI, capítulo, cargo ni cualquier
// otro dato "oficial" que deba controlar Carlos desde el panel.
router.put('/mis-datos', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });

  const b = req.body || {};
  const cols = [];
  const valores = [];
  if (b.celular !== undefined) { cols.push('celular'); valores.push(soloDigitos(b.celular)); }
  if (b.email !== undefined) { cols.push('email'); valores.push(b.email); }
  if (b.foto !== undefined) { cols.push('foto'); valores.push(b.foto); }
  if (cols.length === 0) return res.status(400).json({ error: 'Nada para actualizar.' });

  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  valores.push(servidor.id);
  const { rows } = await query(`UPDATE servidores SET ${setClause}, actualizado_en = now() WHERE id = $${valores.length} RETURNING *`, valores);
  res.json(await construirPerfil(rows[0]));
});

// PUT /api/servidor-portal/dias-asistencia  body: { dni, pin, viernes, sabado, domingo }
router.put('/dias-asistencia', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });
  const b = req.body || {};
  const actualizado = await guardarDiasServidor(servidor.id, { viernes: b.viernes, sabado: b.sabado, domingo: b.domingo });
  res.json(actualizado);
});

/* ------------------------------- TRANSPORTE (propio) ------------------------------- */
// Un servidor puede tener, como máximo, UN registro activo (como pasajero) en el evento
// actual — puede unirse, cambiarse a otro vehículo, o salirse, pero nunca queda en dos al
// mismo tiempo. NO pueden crear vehículos nuevos (eso lo sigue controlando Carlos desde el
// panel) — solo unirse/salirse de los que ya existen.

async function obtenerEventoActual() {
  const { rows } = await query('SELECT id, nombre FROM eventos WHERE es_actual = TRUE LIMIT 1');
  return rows[0] || null;
}

// POST /api/servidor-portal/transporte  body: { dni, pin } -> estado actual + opciones disponibles
router.post('/transporte', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });

  const evento = await obtenerEventoActual();
  if (!evento) return res.json({ evento: null, mi_transporte_id: null, disponibles: [] });

  const { rows: transportes } = await query(
    `SELECT t.id, t.ciudad, t.fecha_salida, t.hora_salida, s.nombre_completo AS conductor_nombre,
            tv.nombre AS tipo_vehiculo_nombre, COALESCE(t.capacidad_personalizada, tv.capacidad) AS capacidad,
            (SELECT COUNT(*)::int FROM transporte_pasajeros WHERE transporte_id = t.id) AS ocupados
     FROM transportes t
     LEFT JOIN servidores s ON s.id = t.conductor_id
     JOIN tipos_vehiculo tv ON tv.id = t.tipo_vehiculo_id
     WHERE t.evento_id = $1
     ORDER BY t.fecha_salida, t.hora_salida NULLS LAST`,
    [evento.id]
  );

  const { rows: miPasajeria } = await query(
    `SELECT tp.transporte_id FROM transporte_pasajeros tp
     JOIN transportes t ON t.id = tp.transporte_id
     WHERE tp.servidor_id = $1 AND t.evento_id = $2`,
    [servidor.id, evento.id]
  );
  const miTransporteId = miPasajeria[0]?.transporte_id || null;

  res.json({
    evento,
    mi_transporte_id: miTransporteId,
    disponibles: transportes.map(t => ({ ...t, lleno: t.ocupados >= t.capacidad }))
  });
});

// POST /api/servidor-portal/transporte/unirme  body: { dni, pin, transporte_id }
router.post('/transporte/unirme', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });

  const transporteId = req.body?.transporte_id;
  if (!transporteId) return res.status(400).json({ error: 'Falta indicar el vehículo.' });

  const evento = await obtenerEventoActual();
  if (!evento) return res.status(400).json({ error: 'No hay ningún evento activo por ahora.' });

  const { rows: destino } = await query(
    `SELECT t.id, COALESCE(t.capacidad_personalizada, tv.capacidad) AS capacidad,
            (SELECT COUNT(*)::int FROM transporte_pasajeros WHERE transporte_id = t.id) AS ocupados
     FROM transportes t JOIN tipos_vehiculo tv ON tv.id = t.tipo_vehiculo_id
     WHERE t.id = $1 AND t.evento_id = $2`,
    [transporteId, evento.id]
  );
  if (!destino[0]) return res.status(404).json({ error: 'Ese vehículo no existe o no es del evento actual.' });
  if (destino[0].ocupados >= destino[0].capacidad) return res.status(409).json({ error: 'Ese vehículo ya está lleno.' });

  // Máximo 1 activo por evento: primero se sale de cualquier otro que tuviera, luego se une.
  await query(
    `DELETE FROM transporte_pasajeros WHERE servidor_id = $1
     AND transporte_id IN (SELECT id FROM transportes WHERE evento_id = $2)`,
    [servidor.id, evento.id]
  );
  await query('INSERT INTO transporte_pasajeros (transporte_id, servidor_id) VALUES ($1,$2)', [transporteId, servidor.id]);
  res.json({ mensaje: 'Te uniste a este transporte.' });
});

// POST /api/servidor-portal/transporte/salir  body: { dni, pin }
router.post('/transporte/salir', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });

  const evento = await obtenerEventoActual();
  if (!evento) return res.json({ mensaje: 'No hay ningún evento activo.' });

  await query(
    `DELETE FROM transporte_pasajeros WHERE servidor_id = $1
     AND transporte_id IN (SELECT id FROM transportes WHERE evento_id = $2)`,
    [servidor.id, evento.id]
  );
  res.json({ mensaje: 'Saliste de tu transporte.' });
});

/* -------------------------------- INVENTARIO (solo ver) -------------------------------- */

// POST /api/servidor-portal/inventario  body: { dni, pin } -> solo lectura, mismas
// categorías fijas que ve Carlos en el panel, sin ningún botón de editar.
router.post('/inventario', async (req, res) => {
  const servidor = await verificarServidor(req.body?.dni, req.body?.pin);
  if (!servidor) return res.status(401).json({ error: 'Número de identidad o PIN incorrectos.' });

  const evento = await obtenerEventoActual();
  const eventoId = evento?.id || null;

  const { rows: categorias } = await query(`SELECT id, nombre, orden FROM categorias_inventario WHERE tipo = 'fija' ORDER BY orden`);
  const resultado = [];
  for (const cat of categorias) {
    const { rows: items } = await query(
      `SELECT i.id, i.nombre, i.tipo_medida, ie.cantidad_actual, ie.estado_actual
       FROM items_inventario i
       LEFT JOIN inventario_evento ie ON ie.item_id = i.id AND ie.evento_id = $2
       WHERE i.categoria_id = $1 AND i.conferencia_id IS NULL
       ORDER BY i.nombre`,
      [cat.id, eventoId]
    );
    resultado.push({ ...cat, items });
  }
  res.json({ evento, categorias: resultado });
});

export default router;
