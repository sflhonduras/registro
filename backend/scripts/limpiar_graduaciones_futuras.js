// Limpia (deja en blanco) las fechas de graduación en el futuro que quedaron en niveles
// históricos (ciclo 1-4) — causadas por el "auto-relleno inteligente" del panel, que rellena
// la fecha vacía con la fecha del PRÓXIMO evento en vivo, sin saber que ese nivel ya es
// histórico. No se repone con ninguna fecha inventada — mejor vacío que un dato falso.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/limpiar_graduaciones_futuras.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, e.orden, i.ciclo, i.fecha_graduacion
    FROM inscripciones i
    JOIN participantes p ON p.id = i.participante_id
    JOIN eventos e ON e.id = i.evento_id
    WHERE i.ciclo BETWEEN 1 AND 4
      AND i.fecha_graduacion IS NOT NULL
      AND i.fecha_graduacion > now()
    ORDER BY p.nombre_completo
  `);

  console.log(`Encontrados: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`[${r.nombre_completo}] (#${r.participante_id}) · Nivel ${r.orden} · graduación futura "${r.fecha_graduacion.toISOString().slice(0, 10)}" -> (en blanco)`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET fecha_graduacion = NULL WHERE id = $1', [r.id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
