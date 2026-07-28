// Siembra en inscripciones_historial la "vuelta" antigua de dos personas que repitieron los
// 4 niveles, y que quedó sobrescrita en su momento por el mismo problema de arquitectura que
// ya corregimos (una sola fila por participante+nivel). Los datos exactos se recuperaron del
// Excel original de las 4 promociones (mismo DNI en dos hojas distintas).
//
// - Mario Nuila (DNI 0801-1977-09507): Promoción 2 (04/06/2025) -> se archiva.
//   Su Promoción 3 (02/11/2025) ya está correcta en la tabla actual, no se toca.
// - Melvin Godoy (DNI 0801-1973-02660): Promoción 1 (13/10/2024) -> se archiva.
//   Su Promoción 3 (02/11/2025) ya está correcta en la tabla actual, no se toca.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/sembrar_historial_repeticiones.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

const VUELTAS_A_SEMBRAR = [
  { dni: '0801197709507', nombre: 'Mario Nuila', ciclo: 2, promocion: '2', fecha: '2025-06-04' },
  { dni: '0801197302660', nombre: 'Melvin Godoy', ciclo: 1, promocion: '1', fecha: '2024-10-13' },
];

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: nivelIVRows } = await pool.query('SELECT id FROM eventos WHERE orden = 4');
  const nivelIVId = nivelIVRows[0]?.id;

  for (const v of VUELTAS_A_SEMBRAR) {
    const { rows } = await pool.query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [v.dni]);
    const participante = rows[0];
    if (!participante) {
      console.log(`[${v.nombre}] no se encontró ningún participante con DNI ${v.dni} — se omite.`);
      continue;
    }

    const { rows: yaExiste } = await pool.query(
      `SELECT id FROM inscripciones_historial WHERE participante_id = $1 AND evento_id = $2 AND promocion_graduacion = $3`,
      [participante.id, nivelIVId, v.promocion]
    );
    if (yaExiste.length) {
      console.log(`[${participante.nombre_completo}] ya tiene sembrada la Promoción ${v.promocion} en el historial — se omite.`);
      continue;
    }

    console.log(`[${participante.nombre_completo}] (#${participante.id}) -> se archiva Promoción ${v.promocion}, ciclo ${v.ciclo}, graduación ${v.fecha}`);
    if (aplicar) {
      await pool.query(
        `INSERT INTO inscripciones_historial
           (participante_id, evento_id, ciclo, fecha_graduacion, promocion_graduacion, registrado_en, origen, motivo)
         VALUES ($1, $2, $3, $4, $5, $4, 'import_historico', 'importado_historico')`,
        [participante.id, nivelIVId, v.ciclo, v.fecha, v.promocion]
      );
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
