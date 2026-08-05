// Investiga la discrepancia: el reporte de medallas cuenta 313 "repeticiones de Platino"
// pero solo hay 260 graduados de Nivel IV en total (imposible tener más repeticiones que
// graduados). Este script muestra, para una muestra de participantes con "más de una
// graduación de Nivel IV", el detalle completo de esas filas (actual + historial) para ver
// si son de verdad graduaciones distintas o solo ediciones/correcciones de la misma.
// No modifica nada.
//
// Uso:
//   node scripts/investigar_graduaciones_duplicadas_nivel4.js

import { pool } from '../src/db.js';

async function main() {
  const nivel4Res = await pool.query('SELECT id FROM eventos WHERE orden = 4');
  const nivel4Id = nivel4Res.rows[0].id;

  const conteoRes = await pool.query(`
    WITH graduaciones AS (
      SELECT i.participante_id, i.fecha_graduacion, i.promocion_graduacion, i.ciclo, 'actual' AS origen
      FROM inscripciones i WHERE i.evento_id = $1 AND i.fecha_graduacion IS NOT NULL
      UNION ALL
      SELECT ih.participante_id, ih.fecha_graduacion, ih.promocion_graduacion, ih.ciclo, 'historial' AS origen
      FROM inscripciones_historial ih WHERE ih.evento_id = $1 AND ih.fecha_graduacion IS NOT NULL
    )
    SELECT participante_id, COUNT(*)::int AS total FROM graduaciones GROUP BY participante_id ORDER BY total DESC
  `, [nivel4Id]);

  const conMasDeUna = conteoRes.rows.filter(r => r.total > 1);
  console.log(`Total participantes con más de 1 "graduación" de Nivel IV detectada: ${conMasDeUna.length}`);
  console.log(`(Recuerda: el total de graduados de Nivel IV en la historia es 260 — si este número es mayor a 259, hay un problema.)\n`);

  console.log('=== Distribución: cuántas "graduaciones" tiene cada quien ===');
  const distribucion = new Map();
  for (const r of conMasDeUna) distribucion.set(r.total, (distribucion.get(r.total) || 0) + 1);
  [...distribucion.entries()].sort((a, b) => a[0] - b[0]).forEach(([cantidad, personas]) => {
    console.log(`  - ${cantidad} "graduaciones": ${personas} persona(s)`);
  });

  console.log('\n=== Detalle completo de los primeros 5 casos (para ver si son reales o duplicados) ===');
  for (const r of conMasDeUna.slice(0, 5)) {
    const detalleRes = await pool.query(`
      SELECT p.nombre_completo, p.dni, i.fecha_graduacion, i.promocion_graduacion, i.ciclo, i.registrado_en, 'actual' AS origen
      FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
      WHERE i.participante_id = $1 AND i.evento_id = $2 AND i.fecha_graduacion IS NOT NULL
      UNION ALL
      SELECT p.nombre_completo, p.dni, ih.fecha_graduacion, ih.promocion_graduacion, ih.ciclo, ih.registrado_en, 'historial (' || COALESCE(ih.motivo, 'sin motivo') || ')' AS origen
      FROM inscripciones_historial ih JOIN participantes p ON p.id = ih.participante_id
      WHERE ih.participante_id = $1 AND ih.evento_id = $2 AND ih.fecha_graduacion IS NOT NULL
      ORDER BY fecha_graduacion
    `, [r.participante_id, nivel4Id]);

    console.log(`\n--- Participante #${r.participante_id} (${r.total} "graduaciones") ---`);
    detalleRes.rows.forEach(d => {
      console.log(`  ${d.nombre_completo} (DNI ${d.dni}) · ciclo ${d.ciclo} · promoción "${d.promocion_graduacion}" · graduación ${d.fecha_graduacion.toISOString().slice(0,10)} · registrado ${d.registrado_en ? d.registrado_en.toISOString().slice(0,10) : '(sin fecha)'} · origen: ${d.origen}`);
    });
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
