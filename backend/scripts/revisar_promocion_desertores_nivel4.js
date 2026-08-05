// Solo lectura: para el grupo de desertores de Nivel IV, revisa si su fila de Nivel III
// tiene la promoción correcta — según la misma regla que ya usamos en todo el sistema:
// promocion_graduacion debe ser igual al número de ciclo (como texto). Reporta quién no
// coincide o tiene la promoción vacía. No modifica nada.
//
// Uso:
//   node scripts/revisar_promocion_desertores_nivel4.js

import { pool } from '../src/db.js';

async function main() {
  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (3,4) ORDER BY orden');
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);
  const nivel4 = eventosRes.rows.find(e => e.orden === 4);

  const { rows: desertores } = await pool.query(
    `SELECT p.nombre_completo, p.dni, i.ciclo, i.promocion_graduacion
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel3.id, nivel3.ciclo_actual, nivel4.id]
  );

  const correctos = [];
  const vacios = [];
  const desajustados = [];

  for (const d of desertores) {
    if (d.promocion_graduacion === null || d.promocion_graduacion === '') {
      vacios.push(d);
    } else if (String(d.promocion_graduacion) === String(d.ciclo)) {
      correctos.push(d);
    } else {
      desajustados.push(d);
    }
  }

  console.log(`Total desertores Nivel IV: ${desertores.length}`);
  console.log(`✅ Promoción correcta (= ciclo): ${correctos.length}\n`);

  console.log(`=== Promoción VACÍA (${vacios.length}) ===`);
  vacios.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · ciclo ${d.ciclo}, promoción: (vacío)`));

  console.log(`\n=== Promoción DESAJUSTADA (no coincide con el ciclo) (${desajustados.length}) ===`);
  desajustados.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · ciclo ${d.ciclo}, promoción: "${d.promocion_graduacion}"`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
