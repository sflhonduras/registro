// Compara el Excel de 91 personas (exportado el 10 de julio, "Inscribiéndose ahora" de
// Nivel 1) contra quién está REALMENTE en el ciclo activo de Nivel 1 hoy, para encontrar
// a quién le falta o le sobra. Es de solo lectura, no modifica nada.
//
// Por defecto busca el archivo en backend/data/Participantes_SFL_I_10deJulio2026.xlsx.
//
// Uso:
//   node scripts/comparar_nivel1_91.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rutaArgumento = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.xlsx'));
const rutaArchivo = rutaArgumento || path.join(__dirname, '../data/Participantes_SFL_I_10deJulio2026.xlsx');

function normalizarClave(v) {
  return String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function main() {
  if (!fs.existsSync(rutaArchivo)) {
    console.error('No se encontró el archivo. Colócalo en backend/data/Participantes_SFL_I_10deJulio2026.xlsx, o pasa la ruta como argumento.');
    process.exit(1);
  }

  const wb = xlsx.readFile(rutaArchivo);
  const datosExcel = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const nombresExcel = datosExcel.map(f => f['Nombre Completo']).filter(Boolean);

  const { rows: activos } = await pool.query(`
    SELECT p.id, p.nombre_completo, p.dni, i.ciclo
    FROM participantes p
    JOIN inscripciones i ON i.participante_id = p.id
    JOIN eventos e ON e.id = i.evento_id
    WHERE e.orden = 1 AND i.ciclo = e.ciclo_actual
  `);
  const nombresActivosNormalizados = new Set(activos.map(a => normalizarClave(a.nombre_completo)));

  console.log(`Excel: ${nombresExcel.length} nombres. Activos actuales en Nivel 1 (ciclo en vivo): ${activos.length}.\n`);

  const faltantes = nombresExcel.filter(n => !nombresActivosNormalizados.has(normalizarClave(n)));
  console.log(`=== En el Excel pero YA NO están activos en Nivel 1 hoy (${faltantes.length}) ===`);
  for (const nombre of faltantes) {
    const { rows } = await pool.query('SELECT id, dni FROM participantes WHERE lower(nombre_completo) = lower($1)', [nombre]);
    if (rows.length) {
      const { rows: insc } = await pool.query(
        `SELECT e.orden, i.ciclo, i.fecha_graduacion FROM inscripciones i JOIN eventos e ON e.id = i.evento_id WHERE i.participante_id = $1 ORDER BY e.orden`,
        [rows[0].id]
      );
      console.log(`- "${nombre}" -> SÍ existe en el sistema (#${rows[0].id}, DNI ${rows[0].dni}), pero su Nivel 1 quedó así: ${JSON.stringify(insc)}`);
    } else {
      console.log(`- "${nombre}" -> NO se encontró ningún participante con ese nombre en el sistema.`);
    }
  }

  // Por si acaso, también mostramos quién está activo hoy pero NO estaba en el Excel del 10 de julio (gente nueva, es normal que haya).
  const nombresExcelNormalizados = new Set(nombresExcel.map(normalizarClave));
  const nuevos = activos.filter(a => !nombresExcelNormalizados.has(normalizarClave(a.nombre_completo)));
  console.log(`\n=== Activos hoy que NO estaban en el Excel del 10 de julio (${nuevos.length}, es normal si se inscribió gente nueva después) ===`);
  for (const n of nuevos) console.log(`- ${n.nombre_completo} (#${n.id})`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
