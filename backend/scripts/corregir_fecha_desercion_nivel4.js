// Corrige `registrado_en` del Nivel III para el grupo de "deserción real" hacia Nivel IV
// (completaron Nivel III en un ciclo cerrado, nunca se registraron en Nivel IV). A TODOS se
// les deja la misma fecha: 11 de agosto de 2024 (confirmada por Carlos para este grupo
// completo, sin distinción de la fecha que tuvieran antes).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_fecha_desercion_nivel4.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_REAL = '2024-08-11';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (3,4) ORDER BY orden');
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);
  const nivel4 = eventosRes.rows.find(e => e.orden === 4);

  const { rows: desertores } = await pool.query(
    `SELECT i.id, p.nombre_completo, p.dni, i.ciclo, i.registrado_en
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel3.id, nivel3.ciclo_actual, nivel4.id]
  );

  console.log(`Total desertores Nivel IV encontrados: ${desertores.length}\n`);

  let sinCambio = 0;
  for (const d of desertores) {
    const fechaActual = d.registrado_en ? d.registrado_en.toISOString().slice(0, 10) : '(sin fecha)';
    if (fechaActual === FECHA_REAL) {
      sinCambio++;
      continue;
    }
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · registrado_en: ${fechaActual} -> ${FECHA_REAL}`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET registrado_en = $1 WHERE id = $2', [FECHA_REAL, d.id]);
    }
  }

  console.log(`\nYa tenían la fecha correcta (sin cambio): ${sinCambio}`);
  console.log(`Total ${aplicar ? 'corregidos' : 'a corregir'}: ${desertores.length - sinCambio}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
