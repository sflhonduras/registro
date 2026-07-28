// Agrega manualmente a una persona que no se encontró en el sistema durante la importación
// de promociones históricas, usando un DNI temporal (identificable) hasta que se consiga el real.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/agregar_anthony_galeas.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

const NOMBRE = 'Anthony Jafet Galeas Velasquez';
const DNI_TEMPORAL = 'PENDIENTE-ANTHONY-GALEAS'; // reemplazar por el DNI real en cuanto se consiga
const OBSERVACION = 'DNI pendiente de confirmar — agregado manualmente al importar Promoción 3.';
const CICLO = 3;
const PROMOCION = '3';
const FECHA_GRADUACION = '2025-11-02';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: yaExiste } = await pool.query('SELECT id FROM participantes WHERE dni = $1', [DNI_TEMPORAL]);
  if (yaExiste.length) {
    console.log(`Ya existe un participante con este DNI temporal (#${yaExiste[0].id}) — no se vuelve a crear.`);
    await pool.end();
    return;
  }

  const { rows: nivelIVRows } = await pool.query('SELECT id FROM eventos WHERE orden = 4');
  const nivelIVId = nivelIVRows[0]?.id;
  if (!nivelIVId) { console.error('No se encontró el Nivel IV.'); process.exit(1); }

  console.log(`Se creará: ${NOMBRE}`);
  console.log(`  DNI temporal: ${DNI_TEMPORAL}`);
  console.log(`  Nivel IV -> ciclo ${CICLO}, promoción ${PROMOCION}, graduación ${FECHA_GRADUACION}`);
  console.log(`  Observación: "${OBSERVACION}"`);

  if (aplicar) {
    const { rows } = await pool.query(
      `INSERT INTO participantes (nombre_completo, dni, observacion) VALUES ($1, $2, $3) RETURNING id`,
      [NOMBRE, DNI_TEMPORAL, OBSERVACION]
    );
    const participanteId = rows[0].id;
    await pool.query(
      `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, fecha_graduacion, origen, registrado_en)
       VALUES ($1, $2, $3, $4, $5, 'import_historico', now())`,
      [participanteId, nivelIVId, CICLO, PROMOCION, FECHA_GRADUACION]
    );
    console.log(`\n✅ Creado como participante #${participanteId}.`);
  } else {
    console.log('\nNada se guardó todavía. Corre con --aplicar para guardar.');
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
