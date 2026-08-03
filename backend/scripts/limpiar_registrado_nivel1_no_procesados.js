// Corrige, para el Nivel 1 histórico de Promoción 1, tres cosas en la misma fila si hace
// falta: `ciclo` = 1, `promocion` = 1, y `registrado_en` = 2023-08-13 (fecha real confirmada
// por Carlos). Aplica a los participantes que NUNCA fueron tocados por los scripts de
// corrección de Promoción 1 (corregir_fechas_nivel1_promocion1.js,
// resolver_ambiguos_nivel1_promocion1.js) — se detectan porque su Nivel 1 quedó con
// `registrado_en` DESPUÉS que su Nivel 2/3 ya corregido (orden ilógico), y NO están activos
// hoy en el ciclo en vivo (eso ya se descarta aparte, ver `investigar_orden_ilogico_nivel1.js`).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/limpiar_registrado_nivel1_no_procesados.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_REAL_NIVEL1_PROMOCION1 = '2023-08-13';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: eventos } = await pool.query('SELECT id, orden, ciclo_actual FROM eventos ORDER BY orden');
  const nivel1 = eventos.find(e => e.orden === 1);
  const ordenPorEvento = new Map(eventos.map(e => [e.id, e.orden]));

  const { rows: inscripciones } = await pool.query(`
    SELECT i.id, i.participante_id, p.nombre_completo, p.dni, i.evento_id, i.ciclo, i.promocion_graduacion, i.registrado_en
    FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
    ORDER BY p.id, i.evento_id
  `);

  const porParticipante = new Map();
  for (const i of inscripciones) {
    if (!porParticipante.has(i.participante_id)) porParticipante.set(i.participante_id, []);
    porParticipante.get(i.participante_id).push({ ...i, orden: ordenPorEvento.get(i.evento_id) });
  }

  const dudosos = [];

  for (const [, filas] of porParticipante) {
    filas.sort((a, b) => a.orden - b.orden);
    const filaNivel1 = filas.find(f => f.orden === 1);
    if (!filaNivel1) continue;
    // Solo nos interesa el Nivel 1 histórico (Promoción 1 = ciclo 1), no el ciclo en vivo
    if (filaNivel1.ciclo !== 1) continue;

    for (let k = 1; k < filas.length; k++) {
      if (filas[k].registrado_en && filaNivel1.registrado_en && new Date(filas[k].registrado_en) < new Date(filaNivel1.registrado_en)) {
        const estaActivoHoy = filaNivel1.ciclo === nivel1.ciclo_actual;
        if (!estaActivoHoy) {
          dudosos.push(filaNivel1);
        }
        break; // solo se reporta una vez por participante
      }
    }
  }

  console.log(`Encontrados: ${dudosos.length}\n`);
  console.log(`Nivel 1 (Promoción 1) sin corregir — se dejará ciclo=1, promocion_graduacion="1", registrado_en=${FECHA_REAL_NIVEL1_PROMOCION1}:\n`);
  for (const r of dudosos) {
    const promocionActual = r.promocion_graduacion === null || r.promocion_graduacion === undefined ? '(vacío)' : `"${r.promocion_graduacion}"`;
    const promocionOk = String(r.promocion_graduacion) === '1';
    console.log(`  - ${r.nombre_completo} (#${r.participante_id}, DNI ${r.dni}) · ciclo actual: ${r.ciclo} · promocion_graduacion actual: ${promocionOk ? '"1" (ya correcta)' : promocionActual + ' -> "1"'} · registrado_en actual: ${r.registrado_en.toISOString().slice(0,10)} -> ${FECHA_REAL_NIVEL1_PROMOCION1}`);
    if (aplicar) {
      await pool.query('UPDATE inscripciones SET ciclo = 1, promocion_graduacion = $1, registrado_en = $2 WHERE id = $3', ['1', FECHA_REAL_NIVEL1_PROMOCION1, r.id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
