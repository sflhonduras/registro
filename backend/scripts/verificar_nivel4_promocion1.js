// Verifica el estado de la Promoción I en Nivel IV: cuántos quedaron con ciclo 1 y
// promoción 1, y si alguno de ellos está también activo hoy en el ciclo en vivo de otro
// nivel (para detectar casos de "doble registro" como el de Héctor Hernandez).
// Es de solo lectura, no modifica nada.
//
// Uso:
//   node scripts/verificar_nivel4_promocion1.js

import { pool } from '../src/db.js';

async function main() {
  const { rows: eventos } = await pool.query('SELECT id, orden, nombre, ciclo_actual FROM eventos ORDER BY orden');
  const nivel4 = eventos.find(e => e.orden === 4);

  const { rows: promocion1 } = await pool.query(`
    SELECT p.id, p.nombre_completo, p.dni, i.ciclo, i.promocion_graduacion, i.fecha_graduacion
    FROM inscripciones i
    JOIN participantes p ON p.id = i.participante_id
    WHERE i.evento_id = $1 AND i.promocion_graduacion = '1'
    ORDER BY p.nombre_completo
  `, [nivel4.id]);

  console.log(`=== Promoción I en Nivel IV ===`);
  console.log(`Total de personas con promoción "1" en Nivel IV: ${promocion1.length}\n`);

  const conCicloIncorrecto = promocion1.filter(p => p.ciclo !== 1);
  if (conCicloIncorrecto.length) {
    console.log(`⚠️  Con promoción 1 pero ciclo distinto de 1 (revisar):`);
    conCicloIncorrecto.forEach(p => console.log(`   - ${p.nombre_completo} (#${p.id}) -> ciclo ${p.ciclo}`));
    console.log('');
  } else {
    console.log('✓ Todos tienen ciclo 1 correctamente.\n');
  }

  const sinFecha = promocion1.filter(p => !p.fecha_graduacion);
  if (sinFecha.length) {
    console.log(`⚠️  Sin fecha de graduación:`);
    sinFecha.forEach(p => console.log(`   - ${p.nombre_completo} (#${p.id})`));
    console.log('');
  }

  // Revisa si alguno de estos está TAMBIÉN activo hoy en el ciclo en vivo de algún otro nivel
  // en Nivel IV mismo (poco probable, pero se revisa por seguridad).
  console.log(`=== Revisión de posibles dobles registros en Nivel IV ===`);
  let dobles = 0;
  for (const p of promocion1) {
    if (p.ciclo === nivel4.ciclo_actual) {
      console.log(`⚠️  ${p.nombre_completo} (#${p.id}) tiene ciclo ${p.ciclo}, que coincide con el ciclo EN VIVO de Nivel IV (#${nivel4.ciclo_actual}) — revisar.`);
      dobles++;
    }
  }
  if (dobles === 0) console.log('✓ Ninguno coincide con el ciclo en vivo actual de Nivel IV. Todo en orden.\n');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
