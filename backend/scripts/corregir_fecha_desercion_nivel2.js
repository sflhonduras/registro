// Corrige `registrado_en` del Nivel I a la fecha real confirmada (7 de mayo de 2023) para
// los participantes que: completaron Nivel I en un ciclo ya cerrado, y NUNCA se registraron
// en Nivel II (el grupo de "deserción real" que ya confirmamos con
// listar_estado_nivel_a_nivel.js). Su fecha de registro estaba contaminada por el mismo
// patrón de corrección masiva que ya vimos antes (2026-07-04) — este grupo no se detectó
// antes porque el script de "orden ilógico" comparaba contra un Nivel II que, en su caso,
// nunca existió.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_fecha_desercion_nivel2.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_REAL = '2023-05-07';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: eventos } = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 1');
  const nivel1 = eventos[0];
  const evento2Res = await pool.query('SELECT id FROM eventos WHERE orden = 2');
  const nivel2Id = evento2Res.rows[0].id;

  const { rows: desertores } = await pool.query(
    `SELECT i.id, p.nombre_completo, p.dni, i.ciclo, i.registrado_en
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel1.id, nivel1.ciclo_actual, nivel2Id]
  );

  console.log(`Encontrados: ${desertores.length}\n`);
  for (const d of desertores) {
    const fechaActual = d.registrado_en ? d.registrado_en.toISOString().slice(0, 10) : '(sin fecha)';
    if (fechaActual === FECHA_REAL) {
      console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · ya tiene la fecha correcta (${FECHA_REAL}), no se toca.`);
      continue;
    }
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · registrado_en actual: ${fechaActual} -> ${FECHA_REAL}`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET registrado_en = $1 WHERE id = $2', [FECHA_REAL, d.id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
