// Corrige `registrado_en` del Nivel II para el grupo de "deserción real" hacia Nivel III
// (completaron Nivel II en un ciclo cerrado, nunca se registraron en Nivel III):
//   - Si la fecha actual es 4 de julio de 2026 (a cualquier hora — dato contaminado por la
//     corrección masiva de meses atrás) -> se cambia a la fecha real confirmada: 4 de agosto
//     de 2024.
//   - Si la fecha actual es 3 de septiembre de 2023 -> ya es correcta, NO se toca.
//   - Cualquier otra fecha -> tampoco se toca, pero se reporta aparte para que Carlos la
//     revise (podría ser otro caso legítimo, o un patrón nuevo que no conocíamos).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_fecha_desercion_nivel3.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_CONTAMINADA = '2026-07-04';
const FECHA_REAL = '2024-08-04';
const FECHA_YA_CORRECTA = '2023-09-03';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (2,3) ORDER BY orden');
  const nivel2 = eventosRes.rows.find(e => e.orden === 2);
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);

  const { rows: desertores } = await pool.query(
    `SELECT i.id, p.nombre_completo, p.dni, i.ciclo, i.registrado_en
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel2.id, nivel2.ciclo_actual, nivel3.id]
  );

  console.log(`Total desertores Nivel III encontrados: ${desertores.length}\n`);

  let corregidos = 0, yaCorrectos = 0, otrasFechas = 0;

  for (const d of desertores) {
    const fechaActual = d.registrado_en ? d.registrado_en.toISOString().slice(0, 10) : null;

    if (fechaActual === FECHA_CONTAMINADA) {
      console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · ${fechaActual} -> ${FECHA_REAL}`);
      corregidos++;
      if (aplicar) {
        await pool.query('UPDATE inscripciones SET registrado_en = $1 WHERE id = $2', [FECHA_REAL, d.id]);
      }
    } else if (fechaActual === FECHA_YA_CORRECTA) {
      yaCorrectos++;
    } else {
      console.log(`  ⚠ ${d.nombre_completo} (DNI ${d.dni}) · fecha inesperada: ${fechaActual || '(sin fecha)'} — no se toca, revisar manualmente.`);
      otrasFechas++;
    }
  }

  console.log('');
  console.log(`Resumen: ${corregidos} corregidos, ${yaCorrectos} ya estaban correctos (3 sept 2023, sin tocar), ${otrasFechas} con fecha inesperada (sin tocar, revisar).`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
