// Investiga los casos donde el Nivel 2 (o superior) de alguien tiene una fecha de registro
// ANTERIOR a su Nivel 1 — separa quién está REALMENTE activo hoy en Nivel 1 (ciclo en vivo,
// caso genuino de reinicio) de quién solo tiene una fecha "rara" sin estar realmente activo
// (posible dato sin corregir todavía, no necesariamente un reinicio real).
// Es de solo lectura, no modifica nada.
//
// Uso:
//   node scripts/investigar_orden_ilogico_nivel1.js

import { pool } from '../src/db.js';

async function main() {
  const { rows: eventos } = await pool.query('SELECT id, orden, ciclo_actual FROM eventos ORDER BY orden');
  const nivel1 = eventos.find(e => e.orden === 1);
  const ordenPorEvento = new Map(eventos.map(e => [e.id, e.orden]));

  const { rows: inscripciones } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, p.dni, i.evento_id, i.ciclo, i.registrado_en
    FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
    ORDER BY p.id, i.evento_id
  `);

  const porParticipante = new Map();
  for (const i of inscripciones) {
    if (!porParticipante.has(i.participante_id)) porParticipante.set(i.participante_id, []);
    porParticipante.get(i.participante_id).push({ ...i, orden: ordenPorEvento.get(i.evento_id) });
  }

  const genuinos = [];
  const dudosos = [];

  for (const [, filas] of porParticipante) {
    filas.sort((a, b) => a.orden - b.orden);
    const filaNivel1 = filas.find(f => f.orden === 1);
    if (!filaNivel1) continue;

    for (let k = 1; k < filas.length; k++) {
      if (filas[k].registrado_en && filaNivel1.registrado_en && new Date(filas[k].registrado_en) < new Date(filaNivel1.registrado_en)) {
        const estaActivoHoy = filaNivel1.ciclo === nivel1.ciclo_actual;
        const linea = `${filaNivel1.nombre_completo} (#${filaNivel1.participante_id}, DNI ${filaNivel1.dni}) · Nivel 1: ciclo ${filaNivel1.ciclo}, registrado ${filaNivel1.registrado_en.toISOString().slice(0,10)} · Nivel ${filas[k].orden}: ${filas[k].registrado_en.toISOString().slice(0,10)}`;
        if (estaActivoHoy) genuinos.push(linea);
        else dudosos.push(linea);
        break; // solo se reporta una vez por participante
      }
    }
  }

  console.log(`=== Genuinamente ACTIVOS hoy en Nivel 1 (ciclo en vivo #${nivel1.ciclo_actual}) — casos reales de reinicio (${genuinos.length}) ===`);
  genuinos.forEach(g => console.log('  - ' + g));

  console.log(`\n=== NO están activos hoy, pero su Nivel 1 tiene una fecha que no cuadra (posible dato sin corregir, revisar — ${dudosos.length}) ===`);
  dudosos.forEach(d => console.log('  - ' + d));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
