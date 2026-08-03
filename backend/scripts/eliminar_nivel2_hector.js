// Elimina la inscripción de Nivel 2 de Héctor Marvin Hernandez Aguilar (DNI 1520196400118) —
// no se tiene certeza de si realmente cursó el Nivel II en el pasado, ni la fecha real.
// Antes de eliminar, se archiva el estado actual en el historial por seguridad.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/eliminar_nivel2_hector.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const DNI = '1520196400118';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: participanteRows } = await pool.query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [DNI]);
  const participante = participanteRows[0];
  if (!participante) { console.error(`No se encontró ningún participante con DNI ${DNI}.`); process.exit(1); }

  const { rows: eventoRows } = await pool.query('SELECT id FROM eventos WHERE orden = 2');
  const nivel2Id = eventoRows[0].id;

  const { rows: inscRows } = await pool.query(
    'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
    [participante.id, nivel2Id]
  );
  const actual = inscRows[0];
  if (!actual) {
    console.log(`${participante.nombre_completo} no tiene ninguna inscripción de Nivel 2 — nada que eliminar.`);
    await pool.end();
    return;
  }

  console.log(`${participante.nombre_completo} (#${participante.id})`);
  console.log(`Se eliminará su Nivel 2: ciclo ${actual.ciclo}, promoción ${actual.promocion_graduacion}, graduación ${actual.fecha_graduacion}, registrado ${actual.registrado_en}`);

  if (aplicar) {
    await pool.query(
      `INSERT INTO inscripciones_historial
         (participante_id, evento_id, ciclo, fecha_graduacion, promocion_graduacion, registrado_en, origen, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'eliminado')`,
      [actual.participante_id, actual.evento_id, actual.ciclo, actual.fecha_graduacion,
        actual.promocion_graduacion, actual.registrado_en, actual.origen]
    );
    await pool.query('DELETE FROM inscripciones WHERE id = $1', [actual.id]);
    console.log('\n✅ Eliminado (archivado antes de borrar).');
  } else {
    console.log('\nNada se guardó todavía. Corre con --aplicar para guardar.');
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
