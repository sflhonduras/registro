// Corrige, para los 81 casos detectados con orden ilógico en Nivel I (fecha de Nivel I
// posterior a la de Nivel II — mismo grupo que ver_ciclos_nivel1_orden_ilogico.js), su fila
// de Nivel I: registrado_en = 13 de agosto de 2023 (misma fecha real ya confirmada para
// Promoción 1), y promocion_graduacion = "1" para quienes la tengan vacía.
//
// Usa la MISMA detección exacta que ver_ciclos_nivel1_orden_ilogico.js, para no tocar por
// error a nadie fuera de este grupo específico (ej. Manlio/Mario, que también son ciclo 1
// pero con una fecha real distinta, 7 de mayo 2023 — ellos no tienen Nivel II, así que nunca
// entran a este grupo).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_nivel1_orden_ilogico_desertores3.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_REAL = '2023-08-13';
const PROMOCION_REAL = '1';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2,3) ORDER BY orden');
  const nivel1 = eventosRes.rows.find(e => e.orden === 1);
  const nivel2 = eventosRes.rows.find(e => e.orden === 2);
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);

  const { rows: desertores } = await pool.query(
    `SELECT i.participante_id AS id, p.nombre_completo, p.dni, i.registrado_en AS nivel2_fecha
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel2.id, nivel2.ciclo_actual, nivel3.id]
  );

  const ids = desertores.map(d => d.id);
  const nivel1Res = ids.length
    ? await pool.query('SELECT id, participante_id, ciclo, promocion_graduacion, registrado_en FROM inscripciones WHERE evento_id = $1 AND participante_id = ANY($2::int[])', [nivel1.id, ids])
    : { rows: [] };
  const nivel1PorId = new Map(nivel1Res.rows.map(r => [r.participante_id, r]));

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : null;

  let encontrados = 0;
  for (const d of desertores) {
    const n1 = nivel1PorId.get(d.id);
    if (!n1) continue;
    const f1 = fmt(n1.registrado_en);
    const f2 = fmt(d.nivel2_fecha);
    if (!(f1 && f1 >= f2)) continue; // solo el grupo de orden ilógico

    encontrados++;
    const promoActual = n1.promocion_graduacion === null ? '(vacío)' : `"${n1.promocion_graduacion}"`;
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · registrado_en: ${f1} -> ${FECHA_REAL} · promoción: ${promoActual} -> "${PROMOCION_REAL}"`);

    if (aplicar) {
      await pool.query(
        'UPDATE inscripciones SET registrado_en = $1, promocion_graduacion = $2 WHERE id = $3',
        [FECHA_REAL, PROMOCION_REAL, n1.id]
      );
    }
  }

  console.log(`\nTotal corregidos: ${encontrados}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
