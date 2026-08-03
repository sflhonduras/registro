// Corrige el caso de Héctor Marvin Hernandez Aguilar (#264): se registró en Nivel I en 2023
// (Promoción I) Y volvió a registrarse en Nivel I en 2026 — pero al importar el Excel de la
// Promoción I, su registro de 2026 quedó sobrescrito por sus datos de 2023 (misma fila).
//
// Este script:
//   1. Archiva su estado de 2023 (Promoción I) en el historial — no se pierde ese dato real.
//   2. Le devuelve su Nivel 1 al ciclo en vivo actual, con el 10 de julio de 2026 como fecha
//      aproximada de su registro (la más cercana que tenemos: ya aparecía en el reporte de
//      "Inscribiéndose ahora" exportado ese día).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_hector_hernandez.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const DNI = '1520196400118';
const FECHA_APROXIMADA_2026 = '2026-07-10';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: participanteRows } = await pool.query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [DNI]);
  const participante = participanteRows[0];
  if (!participante) { console.error(`No se encontró ningún participante con DNI ${DNI}.`); process.exit(1); }

  const { rows: eventoRows } = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 1');
  const nivel1 = eventoRows[0];

  const { rows: inscRows } = await pool.query(
    'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
    [participante.id, nivel1.id]
  );
  const actual = inscRows[0];
  if (!actual) { console.error('No se encontró la inscripción de Nivel 1 de esta persona.'); process.exit(1); }

  console.log(`${participante.nombre_completo} (#${participante.id})`);
  console.log(`Estado actual de Nivel 1: ciclo ${actual.ciclo}, promoción ${actual.promocion_graduacion}, graduación ${actual.fecha_graduacion}`);
  console.log('');
  console.log(`Se archivará ese estado (Promoción I, 2023) en el historial.`);
  console.log(`Se restaurará su Nivel 1 a: ciclo ${nivel1.ciclo_actual} (en vivo), registrado el ${FECHA_APROXIMADA_2026}, sin fecha de graduación ni promoción (está en curso, no graduado en este nivel).`);

  if (aplicar) {
    await pool.query(
      `INSERT INTO inscripciones_historial
         (participante_id, evento_id, ciclo, fecha_graduacion, promocion_graduacion, registrado_en, origen, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'editado')`,
      [actual.participante_id, actual.evento_id, actual.ciclo, actual.fecha_graduacion,
        actual.promocion_graduacion, actual.registrado_en, actual.origen]
    );
    await pool.query(
      `UPDATE inscripciones SET ciclo = $1, registrado_en = $2, fecha_graduacion = NULL, promocion_graduacion = NULL WHERE id = $3`,
      [nivel1.ciclo_actual, `${FECHA_APROXIMADA_2026} 00:00:00`, actual.id]
    );
    console.log('\n✅ Corregido.');
  } else {
    console.log('\nNada se guardó todavía. Corre con --aplicar para guardar.');
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
