// Resuelve los 10 casos de Nivel I (Promoción I) que quedaron ambiguos (2+ fechas marcadas,
// o ninguna) en el Excel original de 2023. Regla: de las fechas que la persona SÍ tenía
// marcadas, se elige la más reciente que sea ANTERIOR a su fecha ya confirmada de Nivel II
// (para que el orden cronológico entre niveles quede coherente). Si ninguna candidata es
// anterior a su Nivel II, se usa la más temprana de sus candidatas. Para quien no tenía
// ninguna marca (Zimry), se usa la misma lógica contra las 4 fechas posibles en general.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/resolver_ambiguos_nivel1_promocion1.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const CICLO = 1;
const PROMOCION = '1';

const TODAS_LAS_FECHAS = ['2023-02-05', '2023-05-07', '2023-07-16', '2023-08-13'];

// nombre (tal como está en el sistema) -> fechas que tenía marcadas en el Excel original
const CASOS = [
  { nombre: 'Celso Paz Tróchez', candidatas: ['2023-02-05', '2023-07-16', '2023-08-13'] },
  { nombre: 'Gonzalo Nolasco', candidatas: ['2023-02-05', '2023-08-13'] },
  { nombre: 'Joaquin Antonio Salgado Mejía', candidatas: ['2023-05-07', '2023-07-16'] },
  { nombre: 'Joaquin Antonio Salgado Ochoa', candidatas: ['2023-02-05', '2023-05-07'] },
  { nombre: 'José Adrian Franco', candidatas: ['2023-02-05', '2023-05-07'] },
  { nombre: 'José Oswaldo Oliva', candidatas: ['2023-02-05', '2023-05-07'] },
  { nombre: 'Juan Carlos Zavala Avila', candidatas: ['2023-02-05', '2023-05-07', '2023-07-16'] },
  { nombre: 'Mario Sánchez', candidatas: ['2023-02-05', '2023-05-07'] },
  { nombre: 'Silvestre Meza', candidatas: ['2023-02-05', '2023-05-07'] },
  { nombre: 'Zimry Emanuel Santos Vasquez', candidatas: TODAS_LAS_FECHAS },
];

function normalizarClave(v) {
  return String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows: eventos } = await pool.query('SELECT id, orden FROM eventos ORDER BY orden');
  const nivel1 = eventos.find(e => e.orden === 1);
  const nivel2 = eventos.find(e => e.orden === 2);

  const { rows: participantes } = await pool.query('SELECT id, nombre_completo FROM participantes');
  const porNombre = new Map();
  for (const p of participantes) {
    const clave = normalizarClave(p.nombre_completo);
    if (!porNombre.has(clave)) porNombre.set(clave, []);
    porNombre.get(clave).push(p);
  }

  for (const caso of CASOS) {
    const candidatos = porNombre.get(normalizarClave(caso.nombre)) || [];
    if (candidatos.length !== 1) {
      console.log(`[${caso.nombre}] -> ${candidatos.length === 0 ? 'no se encontró en el sistema' : 'coincide con varias personas'} — se omite.`);
      continue;
    }
    const participante = candidatos[0];

    const { rows: insc2 } = await pool.query(
      'SELECT registrado_en FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante.id, nivel2.id]
    );
    const fechaNivel2 = insc2[0]?.registrado_en ? insc2[0].registrado_en.toISOString().slice(0, 10) : null;

    // Elige la candidata más reciente que sea anterior a su Nivel II; si ninguna califica, la más temprana.
    let elegida = null;
    if (fechaNivel2) {
      const anteriores = caso.candidatas.filter(f => f < fechaNivel2).sort();
      elegida = anteriores.length ? anteriores[anteriores.length - 1] : caso.candidatas.slice().sort()[0];
    } else {
      elegida = caso.candidatas.slice().sort()[0];
    }

    const { rows: insc1 } = await pool.query(
      'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante.id, nivel1.id]
    );
    if (!insc1.length) {
      console.log(`[${participante.nombre_completo}] -> no tiene inscripción de Nivel I — se omite.`);
      continue;
    }
    const anterior = insc1[0];

    console.log(`[${participante.nombre_completo}] (#${participante.id}) -> Nivel I: fecha elegida ${elegida} (Nivel II: ${fechaNivel2 || 'sin dato'}), ciclo ${CICLO}, promoción ${PROMOCION}`);
    if (aplicar) {
      if (anterior.fecha_graduacion || anterior.promocion_graduacion) {
        await pool.query(
          `INSERT INTO inscripciones_historial
             (participante_id, evento_id, ciclo, fecha_graduacion, promocion_graduacion, registrado_en, origen, motivo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'editado')`,
          [anterior.participante_id, anterior.evento_id, anterior.ciclo, anterior.fecha_graduacion,
            anterior.promocion_graduacion, anterior.registrado_en, anterior.origen]
        );
      }
      await pool.query(
        'UPDATE inscripciones SET registrado_en = $1, ciclo = $2, promocion_graduacion = $3, fecha_graduacion = $4 WHERE id = $5',
        [`${elegida} 00:00:00`, CICLO, PROMOCION, elegida, anterior.id]
      );
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Agrega --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
