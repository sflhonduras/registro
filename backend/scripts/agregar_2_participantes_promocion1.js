// Agrega a dos participantes de la Promoción I que faltaban en el sistema, con los datos
// disponibles (ninguno trae DNI, así que se usa uno temporal identificable por persona).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/agregar_2_participantes_promocion1.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

const CICLO = 1;
const PROMOCION = '1';
const FECHA_GRADUACION = '2024-10-13';

const PARTICIPANTES = [
  {
    nombre_completo: 'José Adrian Franco',
    dni: 'PENDIENTE-JOSE-ADRIAN-FRANCO',
    capitulo: 'Los Cebollines',
    municipio: 'San Pedro Sula',
    departamento: 'Cortés',
    zona: 'Norte 1',
    cargo_fihnec: 'Secretario JDN',
    celular: null,
    observacion: 'DNI pendiente de confirmar — agregado manualmente al completar la Promoción I.'
  },
  {
    nombre_completo: 'Mario Sánchez',
    dni: 'PENDIENTE-MARIO-SANCHEZ',
    capitulo: 'Comayagua',
    municipio: 'Comayagua',
    departamento: 'Comayagua',
    zona: 'Centro 1',
    cargo_fihnec: 'Presidente de JDN',
    celular: '33696333',
    observacion: 'Q.E.P.D. — falleció. DNI pendiente de confirmar. Agregado manualmente al completar la Promoción I.'
  }
];

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: nivelIVRows } = await pool.query('SELECT id FROM eventos WHERE orden = 4');
  const nivelIVId = nivelIVRows[0]?.id;
  if (!nivelIVId) { console.error('No se encontró el Nivel IV.'); process.exit(1); }

  for (const p of PARTICIPANTES) {
    const { rows: yaExiste } = await pool.query('SELECT id FROM participantes WHERE dni = $1', [p.dni]);
    if (yaExiste.length) {
      console.log(`[${p.nombre_completo}] ya existe con este DNI temporal (#${yaExiste[0].id}) — no se vuelve a crear.`);
      continue;
    }

    console.log(`Se creará: ${p.nombre_completo}`);
    console.log(`  DNI temporal: ${p.dni}`);
    console.log(`  Capítulo: ${p.capitulo} · Municipio: ${p.municipio} · Departamento: ${p.departamento} · Zona: ${p.zona}`);
    console.log(`  Cargo FIHNEC: ${p.cargo_fihnec} · Celular: ${p.celular || '(sin celular)'}`);
    console.log(`  Nivel IV -> ciclo ${CICLO}, promoción ${PROMOCION}, graduación ${FECHA_GRADUACION}`);
    console.log(`  Observación: "${p.observacion}"`);
    console.log('');

    if (aplicar) {
      const { rows } = await pool.query(
        `INSERT INTO participantes (nombre_completo, dni, capitulo, municipio, departamento, zona, cargo_fihnec, celular, observacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [p.nombre_completo, p.dni, p.capitulo, p.municipio, p.departamento, p.zona, p.cargo_fihnec, p.celular, p.observacion]
      );
      const participanteId = rows[0].id;
      await pool.query(
        `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, fecha_graduacion, origen, registrado_en)
         VALUES ($1, $2, $3, $4, $5, 'import_historico', now())`,
        [participanteId, nivelIVId, CICLO, PROMOCION, FECHA_GRADUACION]
      );
      console.log(`✅ Creado como participante #${participanteId}.\n`);
    }
  }

  console.log(aplicar ? '✅ Listo.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
