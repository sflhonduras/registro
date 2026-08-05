// Solo lectura: para las personas cuyo historial de Nivel IV tiene entradas "editado" (no
// reactivaciones reales), revisa su fila ACTUAL (la que de verdad importa) — ciclo,
// promoción y fecha de graduación — para ver cuántas realmente tienen algo mal ahora mismo,
// separado del ruido del historial de auditoría. No modifica nada.
//
// Uso:
//   node scripts/revisar_actual_nivel4_editados.js

import { pool } from '../src/db.js';

async function main() {
  const nivel4Res = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 4');
  const nivel4 = nivel4Res.rows[0];

  const { rows: personas } = await pool.query(`
    SELECT DISTINCT p.id, p.nombre_completo, p.dni, i.ciclo, i.promocion_graduacion, i.fecha_graduacion, i.registrado_en
    FROM inscripciones_historial ih
    JOIN participantes p ON p.id = ih.participante_id
    JOIN inscripciones i ON i.participante_id = ih.participante_id AND i.evento_id = ih.evento_id
    WHERE ih.evento_id = $1 AND ih.motivo = 'editado' AND ih.fecha_graduacion IS NOT NULL
    ORDER BY p.nombre_completo
  `, [nivel4.id]);

  console.log(`Total personas revisadas: ${personas.length}\n`);

  let correctas = 0;
  const problemas = { sinCiclo1a4: [], sinPromocion: [], promocionRara: [], sinGraduacion: [] };

  for (const p of personas) {
    let tieneProblema = false;
    if (p.ciclo === null || p.ciclo < 1 || p.ciclo > 4) { problemas.sinCiclo1a4.push(p); tieneProblema = true; }
    if (!p.promocion_graduacion) { problemas.sinPromocion.push(p); tieneProblema = true; }
    else if (!/^[1-9]\d*$/.test(p.promocion_graduacion) || parseInt(p.promocion_graduacion, 10) > 10) {
      problemas.promocionRara.push(p); tieneProblema = true;
    }
    if (!p.fecha_graduacion) { problemas.sinGraduacion.push(p); tieneProblema = true; }
    if (!tieneProblema) correctas++;
  }

  console.log(`✅ Ya están correctas (ciclo 1-4, promoción válida, con graduación): ${correctas}\n`);

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : '(sin fecha)';

  console.log(`=== Ciclo fuera de 1-4 (${problemas.sinCiclo1a4.length}) ===`);
  problemas.sinCiclo1a4.forEach(p => console.log(`  - ${p.nombre_completo} (DNI ${p.dni}) · ciclo actual: ${p.ciclo} · promoción: "${p.promocion_graduacion}" · graduación: ${fmt(p.fecha_graduacion)}`));

  console.log(`\n=== Promoción vacía (${problemas.sinPromocion.length}) ===`);
  problemas.sinPromocion.forEach(p => console.log(`  - ${p.nombre_completo} (DNI ${p.dni}) · ciclo: ${p.ciclo} · graduación: ${fmt(p.fecha_graduacion)}`));

  console.log(`\n=== Promoción con formato raro (ej. "2024" en vez de "1","2"...) (${problemas.promocionRara.length}) ===`);
  problemas.promocionRara.forEach(p => console.log(`  - ${p.nombre_completo} (DNI ${p.dni}) · ciclo: ${p.ciclo} · promoción actual: "${p.promocion_graduacion}" · graduación: ${fmt(p.fecha_graduacion)}`));

  console.log(`\n=== Sin fecha de graduación en la fila actual (${problemas.sinGraduacion.length}) ===`);
  problemas.sinGraduacion.forEach(p => console.log(`  - ${p.nombre_completo} (DNI ${p.dni}) · ciclo: ${p.ciclo} · promoción: "${p.promocion_graduacion}"`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
