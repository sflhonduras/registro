// Crea la inscripción de Nivel III (que no existía) para 24 personas de la Promoción I que
// según el Excel de asistencia sí hicieron el Nivel III el 11 de agosto de 2024, pero nunca
// se les había creado esa fila en el sistema.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/agregar_nivel3_faltantes_promocion1.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const CICLO = 1;
const PROMOCION = '1';
const FECHA = '2024-08-11';

// IDs de participantes tomados del reporte "Sin inscripción de Nivel III" de la corrida anterior.
const IDS_PARTICIPANTES = [
  310, 218, 311, 326, 312, 314, 315, 242, 295, 316, 317, 321,
  249, 236, 246, 136, 289, 329, 86, 118, 330, 328, 394, 206
];

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: nivel3Rows } = await pool.query('SELECT id FROM eventos WHERE orden = 3');
  const nivel3Id = nivel3Rows[0].id;

  let creados = 0, yaExistian = 0, noEncontrados = 0;

  for (const id of IDS_PARTICIPANTES) {
    const { rows: participanteRows } = await pool.query('SELECT id, nombre_completo FROM participantes WHERE id = $1', [id]);
    const participante = participanteRows[0];
    if (!participante) {
      console.log(`[#${id}] no se encontró ningún participante con este ID — se omite.`);
      noEncontrados++;
      continue;
    }

    const { rows: yaExiste } = await pool.query(
      'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante.id, nivel3Id]
    );
    if (yaExiste.length) {
      console.log(`[${participante.nombre_completo}] (#${id}) ya tiene inscripción de Nivel III — se omite.`);
      yaExistian++;
      continue;
    }

    console.log(`[${participante.nombre_completo}] (#${id}) -> se crea Nivel III: ciclo ${CICLO}, promoción ${PROMOCION}, fecha ${FECHA}`);
    if (aplicar) {
      await pool.query(
        `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, fecha_graduacion, registrado_en, origen)
         VALUES ($1, $2, $3, $4, $5, $6, 'import_historico')`,
        [participante.id, nivel3Id, CICLO, PROMOCION, FECHA, `${FECHA} 00:00:00`]
      );
    }
    creados++;
  }

  console.log('\n--- Resumen ---');
  console.log(`Creados: ${creados}`);
  console.log(`Ya existían (se omitieron): ${yaExistian}`);
  console.log(`No encontrados (ID inválido): ${noEncontrados}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
