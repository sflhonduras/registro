// Profundiza en el hallazgo #6 de auditoria_fechas_ciclos_promociones.js: inscripciones con
// ciclo histórico (1-4) pero `registrado_en` de menos de 90 días — mismo criterio exacto de
// ese script. Para cada caso, revisa las OTRAS inscripciones del mismo participante para
// clasificarlo:
//   a) Probable REINICIO GENUINO: el participante está activo hoy en el ciclo en vivo de
//      algún nivel (como el caso ya confirmado de Eduardo Canales Ortega).
//   b) Probable DATO SUCIO: mismo patrón que ya resolvimos con los 33 casos de Nivel 1
//      Promoción 1 (efecto del "auto-relleno inteligente" u otro script que dejó una fecha
//      de creación/edición reciente en una fila que en realidad es histórica).
//
// Es de solo lectura, no modifica nada.
//
// Uso:
//   node scripts/investigar_ciclo_historico_registro_reciente.js

import { pool } from '../src/db.js';

async function main() {
  const hoy = new Date();

  const { rows: eventos } = await pool.query('SELECT id, orden, ciclo_actual FROM eventos ORDER BY orden');
  const cicloActualPorEvento = new Map(eventos.map(e => [e.id, e.ciclo_actual]));
  const ordenPorEvento = new Map(eventos.map(e => [e.id, e.orden]));

  const { rows: inscripciones } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, p.dni, i.evento_id, i.ciclo, i.registrado_en
    FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
    ORDER BY p.id, i.evento_id
  `);

  const porParticipante = new Map();
  for (const i of inscripciones) {
    if (!porParticipante.has(i.participante_id)) porParticipante.set(i.participante_id, []);
    porParticipante.get(i.participante_id).push({ ...i, orden: ordenPorEvento.get(i.evento_id) });
  }

  const genuinos = [];
  const dudosos = [];

  for (const [, filas] of porParticipante) {
    filas.sort((a, b) => a.orden - b.orden);

    for (const fila of filas) {
      if (fila.ciclo === null || fila.ciclo < 1 || fila.ciclo > 4 || !fila.registrado_en) continue;
      const diasDesdeRegistro = (hoy - new Date(fila.registrado_en)) / (1000 * 60 * 60 * 24);
      if (!(diasDesdeRegistro >= 0 && diasDesdeRegistro < 90)) continue;

      const otrasFilas = filas.filter(f => f.id !== fila.id);
      const estaActivoHoyEnAlgunNivel = otrasFilas.some(f => f.ciclo === cicloActualPorEvento.get(f.evento_id))
        || fila.ciclo === cicloActualPorEvento.get(fila.evento_id);

      const otras = otrasFilas.map(f => `Nivel ${f.orden}: ciclo ${f.ciclo}${f.registrado_en ? ', ' + f.registrado_en.toISOString().slice(0,10) : ' (sin fecha)'}`).join(' · ') || '(sin otras inscripciones)';

      const linea = `${fila.nombre_completo} (#${fila.participante_id}, DNI ${fila.dni}) · Nivel ${fila.orden}: ciclo ${fila.ciclo} (histórico), registrado hace ${Math.round(diasDesdeRegistro)} día(s) (${fila.registrado_en.toISOString().slice(0,10)}) · otras inscripciones: ${otras}`;

      if (estaActivoHoyEnAlgunNivel) genuinos.push(linea);
      else dudosos.push(linea);
    }
  }

  console.log('=== Investigación del hallazgo #6: ciclo histórico con registro reciente (<90 días) ===\n');
  console.log(`=== Probable REINICIO GENUINO (activo hoy en algún nivel en vivo) — ${genuinos.length} ===`);
  genuinos.forEach(g => console.log('  - ' + g));

  console.log(`\n=== Probable DATO SUCIO (mismo patrón del auto-relleno, no activo hoy) — ${dudosos.length} ===`);
  dudosos.forEach(d => console.log('  - ' + d));

  console.log(`\nTotal revisado: ${genuinos.length + dudosos.length}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
