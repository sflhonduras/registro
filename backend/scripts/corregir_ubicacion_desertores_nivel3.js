// Para el grupo de desertores de Nivel III (completaron Nivel II hace tiempo, nunca se
// registraron en Nivel III), revisa a los participantes con departamento o municipio
// faltante:
//   - Si tiene MUNICIPIO pero le falta el DEPARTAMENTO -> se deduce automáticamente
//     (dato real, usando la lista oficial de municipios por departamento).
//   - Si tiene DEPARTAMENTO pero le falta el MUNICIPIO -> NO se puede adivinar (un
//     departamento tiene muchos municipios posibles) -> se reporta para que Carlos lo
//     complete a mano, no se inventa nada.
//   - Si le faltan AMBOS -> se reporta igual, sin tocar nada.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_ubicacion_desertores_nivel3.js --aplicar

import { pool } from '../src/db.js';
import { MUNICIPIOS_POR_DEPARTAMENTO } from '../src/municipios.js';

const aplicar = process.argv.includes('--aplicar');

// Mapa inverso: nombre de municipio (en minúsculas, sin espacios extra) -> departamento real.
const DEPARTAMENTO_POR_MUNICIPIO = new Map();
for (const [depto, municipios] of Object.entries(MUNICIPIOS_POR_DEPARTAMENTO)) {
  for (const m of municipios) {
    DEPARTAMENTO_POR_MUNICIPIO.set(m.trim().toLowerCase(), depto);
  }
}

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const eventosRes = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 2');
  const nivel2 = eventosRes.rows[0];
  const nivel3Res = await pool.query('SELECT id FROM eventos WHERE orden = 3');
  const nivel3Id = nivel3Res.rows[0].id;

  const { rows: desertores } = await pool.query(
    `SELECT p.id, p.nombre_completo, p.dni, p.departamento, p.municipio
     FROM inscripciones i JOIN participantes p ON p.id = i.participante_id
     WHERE i.evento_id = $1 AND i.ciclo <> $2
       AND NOT EXISTS (SELECT 1 FROM inscripciones i2 WHERE i2.participante_id = i.participante_id AND i2.evento_id = $3)
     ORDER BY p.nombre_completo`,
    [nivel2.id, nivel2.ciclo_actual, nivel3Id]
  );

  const faltaDepartamento = desertores.filter(d => d.municipio && !d.departamento);
  const faltaMunicipio = desertores.filter(d => d.departamento && !d.municipio);
  const faltanAmbos = desertores.filter(d => !d.departamento && !d.municipio);

  console.log(`=== Deducibles: tienen municipio, falta departamento (${faltaDepartamento.length}) ===`);
  for (const d of faltaDepartamento) {
    const deptoDeducido = DEPARTAMENTO_POR_MUNICIPIO.get(d.municipio.trim().toLowerCase());
    if (!deptoDeducido) {
      console.log(`  ⚠ ${d.nombre_completo} (DNI ${d.dni}) · municipio "${d.municipio}" no coincide con ningún municipio conocido — revisar manualmente (¿mal escrito?).`);
      continue;
    }
    console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · municipio "${d.municipio}" -> departamento "${deptoDeducido}"`);
    if (aplicar) {
      await pool.query('UPDATE participantes SET departamento = $1 WHERE id = $2', [deptoDeducido, d.id]);
    }
  }

  console.log(`\n=== NO deducibles: tienen departamento, falta municipio (${faltaMunicipio.length}) — revisar manualmente ===`);
  faltaMunicipio.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni}) · departamento: "${d.departamento}" · municipio: (vacío)`));

  console.log(`\n=== Faltan AMBOS (${faltanAmbos.length}) — revisar manualmente ===`);
  faltanAmbos.forEach(d => console.log(`  - ${d.nombre_completo} (DNI ${d.dni})`));

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados (solo los deducibles).' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
