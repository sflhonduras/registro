// Corrige el desfase de UN DÍA que quedó en fecha_graduacion de los 16 desertores de Nivel I
// (causado por pasar la fecha por un objeto Date de JavaScript en el script anterior, el
// mismo tipo de bug de zona horaria que ya hemos visto en pantalla hoy). Esta vez, en vez de
// leer la fecha con JavaScript y reescribirla, se le pide a la base de datos que copie
// registrado_en -> fecha_graduacion DIRECTAMENTE, sin pasar por JavaScript — así es imposible
// que se recorra un día.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_offset_graduacion_desertores_nivel1.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 1');
  const nivel1 = eventosRes.rows[0];
  const nivel2Res = await pool.query('SELECT id FROM eventos WHERE orden = 2');
  const nivel2Id = nivel2Res.rows[0].id;

  // to_char en el propio SQL evita cualquier conversión de JavaScript — así vemos el valor
  // real guardado en la base de datos, sin ningún riesgo de desfase al mostrarlo aquí.
  const { rows: desertores } = await pool.query(
    `SELECT i.id, p.nombre_completo, p.dni,
            to_char(i.registrado_en, 'YYYY-MM-DD') AS registrado_texto,
            to_char(i.fecha_graduacion, 'YYYY-MM-DD') AS graduacion_texto
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel1.id, nivel1.ciclo_actual, nivel2Id]
  );

  console.log(`Total: ${desertores.length}\n`);
  let desajustados = 0;
  for (const d of desertores) {
    if (d.graduacion_texto === d.registrado_texto) continue; // ya está bien, no se toca
    desajustados++;
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · graduación actual: ${d.graduacion_texto} · debería ser: ${d.registrado_texto}`);
    if (aplicar) {
      // Copia registrado_en -> fecha_graduacion DENTRO de Postgres, sin pasar por JS.
      await pool.query('UPDATE inscripciones SET fecha_graduacion = registrado_en WHERE id = $1', [d.id]);
    }
  }

  console.log(`\nDesajustados encontrados: ${desajustados}`);
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
