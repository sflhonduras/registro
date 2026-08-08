// En vez de borrar el registro de historial #882, le cambia el campo "motivo" para dejarlo
// documentado como caso de prueba — así se queda como registro de auditoría, pero deja de
// contar como una "reactivación" real para el cálculo de medallas (que solo cuenta filas con
// motivo = 'reactivado').
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/marcar_como_prueba_jabdiel.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const ID = 882;
const NUEVO_MOTIVO = 'caso de prueba de jabdiel por asignacion de medallas';

async function main() {
  const { rows } = await pool.query(
    `SELECT ih.*, p.nombre_completo, p.dni FROM inscripciones_historial ih
     JOIN participantes p ON p.id = ih.participante_id WHERE ih.id = $1`,
    [ID]
  );
  const registro = rows[0];

  if (!registro) {
    console.log(`No se encontró el registro de historial #${ID}.`);
    await pool.end();
    return;
  }

  console.log(aplicar ? '⚠️  Modo APLICAR: se va a actualizar de verdad.' : 'Modo SIMULACIÓN (no se cambia nada). Corre con --aplicar para aplicar de verdad.');
  console.log('');
  console.log(`Registro #${registro.id} — ${registro.nombre_completo} (DNI ${registro.dni})`);
  console.log(`  Motivo actual: "${registro.motivo}"`);
  console.log(`  Motivo nuevo:  "${NUEVO_MOTIVO}"`);
  console.log('');

  if (!aplicar) {
    console.log('Nada se cambió todavía. Corre de nuevo con --aplicar para aplicar el cambio.');
    await pool.end();
    return;
  }

  await pool.query('UPDATE inscripciones_historial SET motivo = $1 WHERE id = $2', [NUEVO_MOTIVO, ID]);
  console.log(`✅ Actualizado. El registro #${ID} se queda guardado, pero ya no cuenta para el cálculo de medallas.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
