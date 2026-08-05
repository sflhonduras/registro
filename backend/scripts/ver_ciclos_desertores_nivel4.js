// Solo lectura: para el grupo de desertores de Nivel IV, muestra a qué CICLO pertenecen sus
// filas de Nivel I y Nivel II — para saber con certeza si son todos ciclo 1 (como los grupos
// anteriores) antes de forzarlo en algún script de corrección.
//
// Uso:
//   node scripts/ver_ciclos_desertores_nivel4.js

import { pool } from '../src/db.js';

async function main() {
  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2,3,4) ORDER BY orden');
  const eventoPorOrden = new Map(eventosRes.rows.map(e => [e.orden, e]));
  const nivel3 = eventoPorOrden.get(3);
  const nivel4 = eventoPorOrden.get(4);

  const { rows: desertores } = await pool.query(
    `SELECT i.participante_id AS id
     FROM inscripciones i
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)`,
    [nivel3.id, nivel3.ciclo_actual, nivel4.id]
  );
  const ids = desertores.map(d => d.id);

  for (const orden of [1, 2, 3]) {
    const evento = eventoPorOrden.get(orden);
    const filasRes = ids.length
      ? await pool.query('SELECT ciclo, promocion_graduacion, COUNT(*)::int AS total FROM inscripciones WHERE evento_id = $1 AND participante_id = ANY($2::int[]) GROUP BY ciclo, promocion_graduacion ORDER BY ciclo, promocion_graduacion', [evento.id, ids])
      : { rows: [] };
    console.log(`=== Nivel ${orden} — ciclo / promoción encontrados en el grupo (${ids.length} personas) ===`);
    filasRes.rows.forEach(r => {
      const promo = r.promocion_graduacion === null ? '(vacío)' : `"${r.promocion_graduacion}"`;
      console.log(`  - ciclo ${r.ciclo} / promoción ${promo}: ${r.total} persona(s)`);
    });
    const sinFila = ids.length - filasRes.rows.reduce((s, r) => s + r.total, 0);
    if (sinFila > 0) console.log(`  ⚠ Sin ninguna fila de Nivel ${orden}: ${sinFila} persona(s)`);
    console.log('');
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
