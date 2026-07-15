// Rellena participantes.departamento cuando está vacío pero municipio SÍ está lleno,
// usando el mismo mapa municipio -> departamento que ya usan los scripts de importación.
// Nunca sobreescribe un departamento que ya tenga valor.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   npm run rellenar-departamentos -- --aplicar

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapaMunicipioDepartamento = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'municipio_departamento.json'), 'utf8')
);

const aplicar = process.argv.includes('--aplicar');

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log('');

  const { rows } = await pool.query(
    `SELECT id, municipio, departamento FROM participantes
     WHERE (departamento IS NULL OR departamento = '') AND municipio IS NOT NULL AND municipio <> ''`
  );

  let encontrados = 0;
  let sinCoincidencia = 0;

  for (const fila of rows) {
    const depto = mapaMunicipioDepartamento[fila.municipio];
    if (!depto) {
      sinCoincidencia++;
      console.log(`[participantes #${fila.id}] municipio "${fila.municipio}" no está en el mapa — se deja igual.`);
      continue;
    }
    encontrados++;
    console.log(`[participantes #${fila.id}] municipio "${fila.municipio}" -> departamento "${depto}"`);
    if (aplicar) {
      await pool.query('UPDATE participantes SET departamento = $1 WHERE id = $2', [depto, fila.id]);
    }
  }

  console.log('');
  console.log(`Registros con departamento vacío revisados: ${rows.length}`);
  console.log(`Se pudo determinar el departamento en: ${encontrados}`);
  console.log(`Sin coincidencia (municipio no reconocido, se dejó igual): ${sinCoincidencia}`);
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Corre "npm run rellenar-departamentos -- --aplicar" para aplicar.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
