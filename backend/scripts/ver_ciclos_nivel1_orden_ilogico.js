// Solo lectura: para el grupo de 81 desertores de Nivel III cuyo Nivel I quedó con orden
// ilógico (fecha posterior a su Nivel II), muestra a qué CICLO pertenece su fila de Nivel I
// — para saber si es una sola promoción o están mezclados, y así saber qué fecha real pedirle
// a Carlos para cada grupo.
//
// Uso:
//   node scripts/ver_ciclos_nivel1_orden_ilogico.js

import { pool } from '../src/db.js';

async function main() {
  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2,3) ORDER BY orden');
  const nivel1 = eventosRes.rows.find(e => e.orden === 1);
  const nivel2 = eventosRes.rows.find(e => e.orden === 2);
  const nivel3 = eventosRes.rows.find(e => e.orden === 3);

  const { rows: desertores } = await pool.query(
    `SELECT i.participante_id AS id, p.nombre_completo, p.dni, i.registrado_en AS nivel2_fecha
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel2.id, nivel2.ciclo_actual, nivel3.id]
  );

  const ids = desertores.map(d => d.id);
  const nivel1Res = ids.length
    ? await pool.query('SELECT participante_id, ciclo, promocion_graduacion, registrado_en FROM inscripciones WHERE evento_id = $1 AND participante_id = ANY($2::int[])', [nivel1.id, ids])
    : { rows: [] };
  const nivel1PorId = new Map(nivel1Res.rows.map(r => [r.participante_id, r]));

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : null;

  const conteoPorCiclo = new Map();
  const casos = [];

  for (const d of desertores) {
    const n1 = nivel1PorId.get(d.id);
    if (!n1) continue;
    const f1 = fmt(n1.registrado_en);
    const f2 = fmt(d.nivel2_fecha);
    if (f1 && f1 >= f2) {
      const clave = `ciclo ${n1.ciclo} / promoción "${n1.promocion_graduacion}"`;
      conteoPorCiclo.set(clave, (conteoPorCiclo.get(clave) || 0) + 1);
      casos.push({ ...d, ciclo: n1.ciclo, promocion: n1.promocion_graduacion });
    }
  }

  console.log('=== Ciclos/promociones de Nivel I encontrados en el grupo de orden ilógico ===');
  for (const [clave, total] of conteoPorCiclo) {
    console.log(`  - ${clave}: ${total} persona(s)`);
  }

  console.log('\n=== Detalle (primeros 10) ===');
  casos.slice(0, 10).forEach(c => console.log(`  - ${c.nombre_completo} (DNI ${c.dni}) · Nivel I: ciclo ${c.ciclo}, promoción "${c.promocion}"`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
