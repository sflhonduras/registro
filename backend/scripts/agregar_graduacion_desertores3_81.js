// Agrega fecha_graduacion a las filas de Nivel I y Nivel II del mismo grupo de 81 personas
// que ya se corrigió con corregir_nivel1_orden_ilogico_desertores3.js (desertores de Nivel
// III con orden ilógico en Nivel I). Usa la MISMA fecha que su registrado_en ya corregido:
//   Nivel I:  fecha_graduacion = 13 de agosto de 2023
//   Nivel II: fecha_graduacion = 4 de agosto de 2024
//
// Usa la misma detección exacta que los scripts anteriores de este grupo, para no tocar a
// nadie fuera de este conjunto específico de 81 personas.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/agregar_graduacion_desertores3_81.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_GRADUACION_NIVEL1 = '2023-08-13';
const FECHA_GRADUACION_NIVEL2 = '2024-08-04';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2,3) ORDER BY orden');
  const nivel1 = eventosRes.rows.find(e => e.orden === 1);
  const nivel2 = eventosRes.rows.find(e => e.orden === 2);
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);

  // Mismo filtro exacto: desertores de Nivel III...
  const { rows: desertores } = await pool.query(
    `SELECT i.participante_id AS id, p.nombre_completo, p.dni, i.id AS inscripcion_nivel2_id, i.registrado_en AS nivel2_fecha
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel2.id, nivel2.ciclo_actual, nivel3.id]
  );

  const ids = desertores.map(d => d.id);
  const nivel1Res = ids.length
    ? await pool.query('SELECT id, participante_id, registrado_en, fecha_graduacion FROM inscripciones WHERE evento_id = $1 AND participante_id = ANY($2::int[])', [nivel1.id, ids])
    : { rows: [] };
  const nivel1PorId = new Map(nivel1Res.rows.map(r => [r.participante_id, r]));

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : null;

  let encontrados = 0;
  for (const d of desertores) {
    const n1 = nivel1PorId.get(d.id);
    if (!n1) continue;
    // ...y dentro de esos, solo el subgrupo de 81 que ya quedó con registrado_en = 2023-08-13
    // en Nivel I (el que corregimos en el paso anterior).
    if (fmt(n1.registrado_en) !== FECHA_GRADUACION_NIVEL1) continue;

    encontrados++;
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · Nivel I graduación -> ${FECHA_GRADUACION_NIVEL1} · Nivel II graduación -> ${FECHA_GRADUACION_NIVEL2}`);

    if (aplicar) {
      await pool.query('UPDATE inscripciones SET fecha_graduacion = $1 WHERE id = $2', [FECHA_GRADUACION_NIVEL1, n1.id]);
      await pool.query('UPDATE inscripciones SET fecha_graduacion = $1 WHERE id = $2', [FECHA_GRADUACION_NIVEL2, d.inscripcion_nivel2_id]);
    }
  }

  console.log(`\nTotal actualizados: ${encontrados}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
