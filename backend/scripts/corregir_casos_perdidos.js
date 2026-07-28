// Corrige puntualmente los 4 registros que quedaron con departamento vacío después de que
// normalizar-ubicaciones limpiara el municipio (perdiendo la pista "Copán"/"Ocotepeque" que
// traía pegada). Se identificaron a mano revisando el resultado de esa corrida.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_casos_perdidos.js --aplicar

import { pool } from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');

// [id de participante, departamento correcto]
const CORRECCIONES = [
  [289, 'Copán'],   // era "Santa Rita Copan"
  [290, 'Copán'],   // era "Santa Rita Copan"
  [295, 'Copán'],   // era "Santa Rita Copán"
  [280, 'Ocotepeque'], // era "San Marcos Ocotepeque"
];

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  for (const [id, deptoCorrecto] of CORRECCIONES) {
    const { rows } = await pool.query('SELECT id, nombre_completo, municipio, departamento FROM participantes WHERE id = $1', [id]);
    const fila = rows[0];
    if (!fila) { console.log(`[#${id}] no existe, se omite.`); continue; }
    if (fila.departamento && fila.departamento.trim()) {
      console.log(`[#${id}] ${fila.nombre_completo} ya tiene departamento ("${fila.departamento}") — no se toca, por si ya lo corregiste a mano.`);
      continue;
    }
    console.log(`[#${id}] ${fila.nombre_completo} · municipio "${fila.municipio}" · departamento vacío -> "${deptoCorrecto}"`);
    if (aplicar) {
      await pool.query('UPDATE participantes SET departamento = $1 WHERE id = $2', [deptoCorrecto, id]);
    }
  }

  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre con --aplicar para guardar.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
