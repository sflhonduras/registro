// Solo lectura: para el grupo de "deserción real" hacia Nivel II (completaron Nivel I en un
// ciclo cerrado, nunca se registraron en Nivel II — los 16 identificados hoy temprano),
// muestra su ciclo y promoción actuales en la fila de Nivel I.
//
// Uso:
//   node scripts/ver_ciclos_desertores_nivel1.js

import { pool } from '../src/db.js';

async function main() {
  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2) ORDER BY orden');
  const nivel1 = eventosRes.rows.find(e => e.orden === 1);
  const nivel2 = eventosRes.rows.find(e => e.orden === 2);

  const { rows: desertores } = await pool.query(
    `SELECT p.nombre_completo, p.dni, i.ciclo, i.promocion_graduacion, i.registrado_en, i.fecha_graduacion
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel1.id, nivel1.ciclo_actual, nivel2.id]
  );

  const conteo = new Map();
  for (const d of desertores) {
    const promo = d.promocion_graduacion === null ? '(vacío)' : `"${d.promocion_graduacion}"`;
    const clave = `ciclo ${d.ciclo} / promoción ${promo}`;
    conteo.set(clave, (conteo.get(clave) || 0) + 1);
  }

  console.log(`=== Nivel I — ciclo / promoción de los ${desertores.length} desertores hacia Nivel II ===`);
  for (const [clave, total] of conteo) console.log(`  - ${clave}: ${total} persona(s)`);

  console.log('\n=== Detalle completo ===');
  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : '(sin fecha)';
  desertores.forEach(d => {
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · ciclo ${d.ciclo} · promoción ${d.promocion_graduacion === null ? '(vacío)' : `"${d.promocion_graduacion}"`} · registrado ${fmt(d.registrado_en)} · graduación ${fmt(d.fecha_graduacion)}`);
  });

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
