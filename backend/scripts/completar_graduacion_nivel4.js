// Completa la fecha de graduación de Nivel IV para cualquier inscripción que tenga la
// promoción puesta pero le falte la fecha (como el caso de Héctor Rolando Motiño), usando
// la fecha de graduación ya conocida de cada promoción.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/completar_graduacion_nivel4.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

// Promoción -> fecha de graduación de Nivel IV ya confirmada.
const FECHA_POR_PROMOCION = {
  '1': '2024-10-13',
  '2': '2025-06-15',
  '3': '2025-10-05',
  '4': '2026-06-21'
};

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, i.promocion_graduacion
    FROM inscripciones i
    JOIN participantes p ON p.id = i.participante_id
    JOIN eventos e ON e.id = i.evento_id
    WHERE e.orden = 4 AND i.fecha_graduacion IS NULL AND i.promocion_graduacion IS NOT NULL
  `);

  console.log(`Encontrados: ${rows.length}\n`);
  for (const r of rows) {
    const fecha = FECHA_POR_PROMOCION[r.promocion_graduacion];
    if (!fecha) {
      console.log(`[${r.nombre_completo}] (#${r.participante_id}) -> promoción "${r.promocion_graduacion}" desconocida, no se puede completar automáticamente.`);
      continue;
    }
    console.log(`[${r.nombre_completo}] (#${r.participante_id}) -> Nivel IV: promoción "${r.promocion_graduacion}" -> fecha de graduación ${fecha}`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET fecha_graduacion = $1 WHERE id = $2', [fecha, r.id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
