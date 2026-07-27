// Rellena participantes.departamento cuando está vacío pero municipio SÍ está lleno,
// usando el mismo mapa municipio -> departamento que ya usan los scripts de importación.
// Nunca sobreescribe un departamento que ya tenga valor.
//
// Reconoce el municipio SIN IMPORTAR mayúsculas/minúsculas ni acentos (ej. "tocoa",
// "TOCOA" y "Tocoa" se reconocen igual como "Tocoa"), y también corrige la ortografía
// del municipio a la oficial de paso, para no depender de correr antes normalizar-ubicaciones.
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

// Alias conocidos (mismo criterio que normalizar_ubicaciones.js).
const ALIAS_MUNICIPIO = { 'tegucigalpa': 'Distrito Central' };

// Quita acentos, colapsa espacios de sobra y pasa a minúscula, para que "copan",
// "COPÁN" y "Copán" (o "santa   barbara" con espacios de más) se reconozcan igual.
function normalizarClave(valor) {
  return valor.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Diccionario municipio (clave normalizada) -> { nombreOficial, departamento }
const MUNICIPIOS_OFICIALES = {};
for (const [nombre, depto] of Object.entries(mapaMunicipioDepartamento)) {
  MUNICIPIOS_OFICIALES[normalizarClave(nombre)] = { nombreOficial: nombre, departamento: depto };
}

const aplicar = process.argv.includes('--aplicar');

function buscarMunicipio(valor) {
  const clave = normalizarClave(valor);
  const nombreOficialAlias = ALIAS_MUNICIPIO[clave];
  if (nombreOficialAlias) {
    const claveOficial = normalizarClave(nombreOficialAlias);
    return MUNICIPIOS_OFICIALES[claveOficial] || null;
  }
  return MUNICIPIOS_OFICIALES[clave] || null;
}

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
    const match = buscarMunicipio(fila.municipio);
    if (!match) {
      sinCoincidencia++;
      console.log(`[participantes #${fila.id}] municipio "${fila.municipio}" no se reconoce — se deja igual.`);
      continue;
    }
    encontrados++;
    const cambioMunicipio = match.nombreOficial !== fila.municipio;
    console.log(
      `[participantes #${fila.id}] municipio "${fila.municipio}"${cambioMunicipio ? ` -> "${match.nombreOficial}"` : ''} · departamento -> "${match.departamento}"`
    );
    if (aplicar) {
      await pool.query(
        'UPDATE participantes SET departamento = $1, municipio = $2 WHERE id = $3',
        [match.departamento, match.nombreOficial, fila.id]
      );
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
