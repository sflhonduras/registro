// Para el grupo de desertores de Nivel IV (completaron Nivel III en ciclo cerrado, nunca
// se registraron en Nivel IV), corrige de forma integral sus filas de Nivel I, II y III:
//   - Nivel I:  si registrado_en = 4 jul 2026 (dato contaminado) -> 13 de agosto de 2023
//   - Nivel II: si registrado_en = 4 jul 2026 (dato contaminado) -> 4 de agosto de 2024
//   - Nivel III: ya se corrigió antes a 11 de agosto de 2024 (no se toca de nuevo aquí)
//   - En los tres niveles: si promocion_graduacion está vacía, se llena con el número de
//     ciclo (como texto) — misma regla que ya usamos en todo el sistema.
//   - En los tres niveles: si fecha_graduacion está vacía, se llena con la MISMA fecha que
//     el registrado_en (ya corregido) de ese mismo nivel.
// Cualquier fecha de registro que no sea la contaminada esperada NO se toca — se reporta
// aparte para revisión manual.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_completo_desertores_nivel4.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const FECHA_CONTAMINADA = '2026-07-04';
const FECHA_REAL_NIVEL1 = '2023-08-13';
const FECHA_REAL_NIVEL2 = '2024-08-04';

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, orden, ciclo_actual FROM eventos WHERE orden IN (1,2,3,4) ORDER BY orden');
  const eventoPorOrden = new Map(eventosRes.rows.map(e => [e.orden, e]));
  const nivel3 = eventoPorOrden.get(3);
  const nivel4 = eventoPorOrden.get(4);

  const { rows: desertores } = await pool.query(
    `SELECT i.participante_id AS id, p.nombre_completo, p.dni
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel3.id, nivel3.ciclo_actual, nivel4.id]
  );

  const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : null;
  let personasConCambios = 0;

  for (const d of desertores) {
    const filasRes = await pool.query(
      `SELECT i.id, e.orden, i.ciclo, i.registrado_en, i.fecha_graduacion, i.promocion_graduacion
       FROM inscripciones i JOIN eventos e ON e.id = i.evento_id
       WHERE i.participante_id = $1 AND e.orden IN (1,2,3)`,
      [d.id]
    );
    const filaPorNivel = new Map(filasRes.rows.map(f => [f.orden, f]));

    const cambiosPersona = [];

    for (const [orden, fechaRealSiContaminada] of [[1, FECHA_REAL_NIVEL1], [2, FECHA_REAL_NIVEL2], [3, null]]) {
      const fila = filaPorNivel.get(orden);
      if (!fila) continue;

      let nuevoRegistrado = fila.registrado_en;
      const fechaActual = fmt(fila.registrado_en);

      if (fechaRealSiContaminada && fechaActual === FECHA_CONTAMINADA) {
        nuevoRegistrado = fechaRealSiContaminada;
        cambiosPersona.push(`Nivel ${orden} registrado_en: ${fechaActual} -> ${nuevoRegistrado}`);
      } else if (fechaRealSiContaminada && fechaActual && fechaActual !== fechaRealSiContaminada) {
        cambiosPersona.push(`⚠ Nivel ${orden} registrado_en tiene una fecha inesperada (${fechaActual}) — no se toca, revisar manualmente.`);
      }

      // Confirmado con ver_ciclos_desertores_nivel4.js: los 23 de este grupo son ciclo 1 en
      // los tres niveles, así que se puede forzar con seguridad.
      const nuevoCiclo = 1;
      if (fila.ciclo !== nuevoCiclo) {
        cambiosPersona.push(`Nivel ${orden} ciclo: ${fila.ciclo} -> ${nuevoCiclo}`);
      }

      let nuevaPromocion = fila.promocion_graduacion;
      if (!nuevaPromocion) {
        nuevaPromocion = String(nuevoCiclo);
        cambiosPersona.push(`Nivel ${orden} promoción: (vacío) -> "${nuevaPromocion}"`);
      }

      let nuevaGraduacion = fila.fecha_graduacion;
      if (!nuevaGraduacion) {
        nuevaGraduacion = typeof nuevoRegistrado === 'string' ? nuevoRegistrado : fmt(nuevoRegistrado);
        cambiosPersona.push(`Nivel ${orden} graduación: (vacío) -> ${nuevaGraduacion}`);
      }

      if (aplicar && (nuevoRegistrado !== fila.registrado_en || nuevoCiclo !== fila.ciclo || nuevaPromocion !== fila.promocion_graduacion || nuevaGraduacion !== fila.fecha_graduacion)) {
        await pool.query(
          'UPDATE inscripciones SET registrado_en = $1, ciclo = $2, promocion_graduacion = $3, fecha_graduacion = $4 WHERE id = $5',
          [nuevoRegistrado, nuevoCiclo, nuevaPromocion, nuevaGraduacion, fila.id]
        );
      }
    }

    if (cambiosPersona.length > 0) {
      personasConCambios++;
      console.log(`--- ${d.nombre_completo} (DNI ${d.dni}) ---`);
      cambiosPersona.forEach(c => console.log(`    ${c}`));
    }
  }

  console.log(`\nTotal desertores Nivel IV revisados: ${desertores.length}`);
  console.log(`Personas con al menos un cambio: ${personasConCambios}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
