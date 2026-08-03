// Corrige los casos donde el ciclo es correcto (1-4, de nuestras correcciones históricas) pero
// la promoción quedó con un valor distinto — causado por el "auto-relleno inteligente" del
// panel, que rellena la promoción vacía con la promoción del ciclo EN VIVO actual en vez de
// dejarla igual al ciclo histórico. Aquí el ciclo es el dato confiable, así que se usa para
// corregir la promoción (promoción = ciclo, como texto).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_promocion_desajustada.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, e.orden, i.ciclo, i.promocion_graduacion
    FROM inscripciones i
    JOIN participantes p ON p.id = i.participante_id
    JOIN eventos e ON e.id = i.evento_id
    WHERE i.ciclo BETWEEN 1 AND 4
      AND i.promocion_graduacion IS NOT NULL
      AND i.promocion_graduacion ~ '^[0-9]+$'
      AND i.promocion_graduacion::int <> i.ciclo
    ORDER BY p.nombre_completo
  `);

  console.log(`Encontrados: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`[${r.nombre_completo}] (#${r.participante_id}) · Nivel ${r.orden} · promoción "${r.promocion_graduacion}" -> "${r.ciclo}"`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET promocion_graduacion = $1 WHERE id = $2', [String(r.ciclo), r.id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
