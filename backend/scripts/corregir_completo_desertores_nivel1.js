// Deja ciclo, promoción y fecha de graduación CONSISTENTES para los 16 desertores hacia
// Nivel II (completaron Nivel I en ciclo cerrado, nunca se registraron en Nivel II).
// A diferencia de otros scripts del día, aquí se SOBRESCRIBE sin condición (ya se revisó
// caso por caso con ver_ciclos_desertores_nivel1.js y se confirmó que corresponde):
//   - ciclo = 1
//   - promocion_graduacion = "1"
//   - fecha_graduacion = misma fecha que registrado_en (7 de mayo de 2023)
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_completo_desertores_nivel1.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 1');
  const nivel1 = eventosRes.rows[0];
  const nivel2Res = await pool.query('SELECT id FROM eventos WHERE orden = 2');
  const nivel2Id = nivel2Res.rows[0].id;

  const { rows: desertores } = await pool.query(
    `SELECT i.id, p.nombre_completo, p.dni, i.ciclo, i.promocion_graduacion, i.registrado_en, i.fecha_graduacion
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel1.id, nivel1.ciclo_actual, nivel2Id]
  );

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : '(sin fecha)';

  console.log(`Total: ${desertores.length}\n`);
  for (const d of desertores) {
    const fechaRegistrado = d.registrado_en; // ya confirmada: 2023-05-07 para los 16
    console.log(
      `  - ${d.nombre_completo} (DNI ${d.dni}) · ciclo ${d.ciclo}->1 · promoción ${d.promocion_graduacion === null ? '(vacío)' : `"${d.promocion_graduacion}"`}->"1" · graduación ${fmt(d.fecha_graduacion)}->${fmt(fechaRegistrado)}`
    );
    if (aplicar) {
      await pool.query(
        'UPDATE inscripciones SET ciclo = 1, promocion_graduacion = $1, fecha_graduacion = $2 WHERE id = $3',
        ['1', fechaRegistrado, d.id]
      );
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
