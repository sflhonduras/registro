// Diagnóstico: muestra TODAS las inscripciones (actuales e históricas) de un participante,
// para entender por qué el reporte de Repeticiones lo está contando como que repitió un nivel.
// Este script NO borra ni cambia nada — es solo para ver los datos crudos.
//
// Uso: node scripts/diagnosticar_repeticion.js <DNI>

import { pool } from '../src/db.js';

const dni = process.argv[2];

async function main() {
  if (!dni) {
    console.log('Uso: node scripts/diagnosticar_repeticion.js <DNI>');
    await pool.end();
    return;
  }

  const { rows: participantes } = await pool.query('SELECT * FROM participantes WHERE dni = $1', [dni]);
  const p = participantes[0];
  if (!p) {
    console.log(`No se encontró ningún participante con DNI ${dni}.`);
    await pool.end();
    return;
  }

  console.log(`=== ${p.nombre_completo} (#${p.id}, DNI ${p.dni}) ===\n`);

  console.log('--- Inscripciones ACTUALES (tabla inscripciones) ---');
  const { rows: actuales } = await pool.query(
    `SELECT i.id, e.orden AS nivel, e.nombre, i.ciclo, i.fecha_graduacion, i.promocion_graduacion, i.registrado_en, i.origen
     FROM inscripciones i JOIN eventos e ON e.id = i.evento_id
     WHERE i.participante_id = $1 ORDER BY e.orden`,
    [p.id]
  );
  if (actuales.length === 0) console.log('  (ninguna)');
  actuales.forEach(r => {
    console.log(`  Nivel ${r.nivel} (${r.nombre}) — ciclo ${r.ciclo} — graduación: ${r.fecha_graduacion || 'sin fecha'} — promoción: ${r.promocion_graduacion || '—'} — registrado: ${r.registrado_en} — origen: ${r.origen} — id: ${r.id}`);
  });

  console.log('\n--- Historial (tabla inscripciones_historial — copias guardadas antes de reinscribirse) ---');
  const { rows: historial } = await pool.query(
    `SELECT ih.id, e.orden AS nivel, e.nombre, ih.ciclo, ih.fecha_graduacion, ih.promocion_graduacion, ih.registrado_en, ih.origen, ih.motivo
     FROM inscripciones_historial ih JOIN eventos e ON e.id = ih.evento_id
     WHERE ih.participante_id = $1 ORDER BY e.orden`,
    [p.id]
  );
  if (historial.length === 0) console.log('  (ninguno)');
  historial.forEach(r => {
    console.log(`  Nivel ${r.nivel} (${r.nombre}) — ciclo ${r.ciclo} — graduación: ${r.fecha_graduacion || 'sin fecha'} — promoción: ${r.promocion_graduacion || '—'} — registrado: ${r.registrado_en} — origen: ${r.origen} — motivo: ${r.motivo} — id: ${r.id}`);
  });

  console.log('\n--- Medallas otorgadas a mano (tabla medallas_manuales) ---');
  const { rows: manuales } = await pool.query('SELECT * FROM medallas_manuales WHERE participante_id = $1', [p.id]);
  if (manuales.length === 0) console.log('  (ninguna)');
  manuales.forEach(r => console.log(`  ${r.tipo} x${r.cantidad} — nota: ${r.nota || '—'} — id: ${r.id}`));

  console.log('\nCon esto, revisa si hay una graduación de Nivel II duplicada (una en "actuales" y otra en "historial", ambas con fecha de graduación) — eso es lo que hace que el sistema cuente una repetición que en realidad no debería contar como tal.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
