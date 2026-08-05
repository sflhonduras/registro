// Verificación de solo lectura: para cada desertor de Nivel III (completó Nivel II en ciclo
// cerrado, nunca se registró en Nivel III), revisa que su fecha de Nivel I sea ANTERIOR a su
// fecha de Nivel II — el orden lógico esperado. Marca cualquier caso donde:
//   a) Nivel I no tenga fecha o no exista ninguna fila de Nivel I
//   b) Nivel I tenga una fecha IGUAL o POSTERIOR a la de Nivel II (orden ilógico)
// No modifica nada.
//
// Uso:
//   node scripts/verificar_orden_fechas_desertores_nivel3.js

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
    ? await pool.query('SELECT participante_id, registrado_en FROM inscripciones WHERE evento_id = $1 AND participante_id = ANY($2::int[])', [nivel1.id, ids])
    : { rows: [] };
  const nivel1PorId = new Map(nivel1Res.rows.map(r => [r.participante_id, r.registrado_en]));

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : null;

  let ok = 0;
  const sinNivel1 = [];
  const ordenIlogico = [];

  for (const d of desertores) {
    const nivel1Fecha = nivel1PorId.get(d.id);
    const f1 = fmt(nivel1Fecha);
    const f2 = fmt(d.nivel2_fecha);

    if (!nivel1Fecha) {
      sinNivel1.push({ ...d, f1: null, f2 });
    } else if (f1 >= f2) {
      ordenIlogico.push({ ...d, f1, f2 });
    } else {
      ok++;
    }
  }

  console.log(`Total desertores Nivel III revisados: ${desertores.length}`);
  console.log(`✅ Orden correcto (Nivel I antes que Nivel II): ${ok}\n`);

  console.log(`=== Sin fecha o sin fila de Nivel I (${sinNivel1.length}) ===`);
  sinNivel1.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · Nivel I: sin fecha · Nivel II: ${d.f2}`));

  console.log(`\n=== Orden ilógico: Nivel I igual o posterior a Nivel II (${ordenIlogico.length}) ===`);
  ordenIlogico.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · Nivel I: ${d.f1} · Nivel II: ${d.f2}`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
