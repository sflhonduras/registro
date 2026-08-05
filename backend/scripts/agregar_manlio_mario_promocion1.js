// Agrega dos participantes nuevos al Nivel I (Promoción 1, ciclo 1) que no estaban en el
// sistema: Manlio José Ceroni y Mario Vargas. Los campos que no vienen en el Excel de origen
// se dejan en blanco (NULL) — no se inventa ningún dato.
//
// Antes de crear un participante nuevo, revisa si ya existe por DNI (o por nombre normalizado
// como respaldo) para no duplicarlo — si ya existe, NO lo toca y lo reporta para revisión manual.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/agregar_manlio_mario_promocion1.js --aplicar

import { pool } from '../src/db.js';
import { normalizarNombre, soloDigitos } from '../src/texto.js';

const aplicar = process.argv.includes('--aplicar');

const PERSONAS = [
  {
    nombre_completo: 'Manlio José Ceroni',
    dni: '3108201200006',
    capitulo: 'José y Pepes',
    municipio: 'Tegucigalpa',
    departamento: 'Francisco Morazán', // deducido del municipio, no inventado
    zona: 'Centro 1a',
    cargo_fihnec: 'Servidor',
    celular: '92252680',
    registrado_en: '2023-05-07',
    promocion_graduacion: '1'
  },
  {
    nombre_completo: 'Mario Vargas',
    dni: '1610198900062',
    capitulo: 'La Aurora',
    municipio: 'La Ceiba',
    departamento: 'Atlántida', // deducido del municipio, no inventado
    zona: 'Atlantida',
    cargo_fihnec: 'Servidor',
    celular: '98616097',
    registrado_en: '2023-05-07',
    promocion_graduacion: '1'
  }
];

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: eventos } = await pool.query('SELECT id, orden, ciclo_actual FROM eventos ORDER BY orden');
  const nivel1 = eventos.find(e => e.orden === 1);

  for (const p of PERSONAS) {
    console.log(`--- ${p.nombre_completo} (DNI ${p.dni}) ---`);

    // Buscar si ya existe: primero por DNI, luego por nombre normalizado como respaldo.
    const porDni = await pool.query('SELECT id, nombre_completo FROM participantes WHERE dni = $1', [p.dni]);
    let participante = porDni.rows[0];

    if (!participante) {
      const nombreNorm = normalizarNombre(p.nombre_completo);
      const porNombre = await pool.query(
        'SELECT id, nombre_completo, dni FROM participantes WHERE UPPER(nombre_completo) = UPPER($1)',
        [nombreNorm]
      );
      if (porNombre.rows[0]) {
        console.log(`  ⚠ Ya existe alguien con ese nombre (#${porNombre.rows[0].id}, DNI ${porNombre.rows[0].dni || '(vacío)'}), pero con otro DNI.`);
        console.log('  No se toca — revisar manualmente si es la misma persona.');
        console.log('');
        continue;
      }
    }

    let participanteId;
    if (participante) {
      console.log(`  Ya existe como participante #${participante.id} (${participante.nombre_completo}). No se crea de nuevo.`);
      participanteId = participante.id;
    } else {
      console.log(`  Participante nuevo — se creará con: capítulo="${p.capitulo}", municipio="${p.municipio}", departamento="${p.departamento}" (deducido), zona="${p.zona}", cargo="${p.cargo_fihnec}", celular="${p.celular}". Resto de campos en blanco.`);
      if (aplicar) {
        const insertRes = await pool.query(
          `INSERT INTO participantes (nombre_completo, dni, celular, capitulo, zona, departamento, municipio, cargo_fihnec)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [normalizarNombre(p.nombre_completo), p.dni, soloDigitos(p.celular), normalizarNombre(p.capitulo), p.zona, p.departamento, p.municipio, p.cargo_fihnec]
        );
        participanteId = insertRes.rows[0].id;
      }
    }

    // Inscripción a Nivel I, ciclo 1 (Promoción 1) — protegido para no sobrescribir un
    // registro activo del ciclo en vivo.
    if (aplicar && participanteId) {
      const existenteInsc = await pool.query(
        'SELECT id, ciclo FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
        [participanteId, nivel1.id]
      );
      if (existenteInsc.rows[0]) {
        if (existenteInsc.rows[0].ciclo === nivel1.ciclo_actual) {
          console.log('  ⚠ Ya tiene una inscripción ACTIVA en el ciclo en vivo de Nivel I — no se toca, revisar manualmente.');
        } else {
          console.log(`  Ya tenía una inscripción de Nivel I (ciclo ${existenteInsc.rows[0].ciclo}) — se actualiza a ciclo 1 / Promoción 1 / ${p.registrado_en}.`);
          await pool.query(
            'UPDATE inscripciones SET ciclo = 1, promocion_graduacion = $1, registrado_en = $2 WHERE id = $3',
            [p.promocion_graduacion, p.registrado_en, existenteInsc.rows[0].id]
          );
        }
      } else {
        await pool.query(
          `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, registrado_en, origen)
           VALUES ($1,$2,1,$3,$4,'script_historico')`,
          [participanteId, nivel1.id, p.promocion_graduacion, p.registrado_en]
        );
        console.log('  ✅ Inscripción a Nivel I (ciclo 1, Promoción 1) creada.');
      }
    } else if (!aplicar) {
      console.log(`  Se crearía/actualizaría su inscripción a Nivel I: ciclo=1, promoción="1", registrado_en=${p.registrado_en}.`);
    }
    console.log('');
  }

  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
