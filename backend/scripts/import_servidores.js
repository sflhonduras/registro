// Importa la lista de Servidores del SFL desde el Excel entregado.
// Uso: node scripts/import_servidores.js /ruta/al/BD_SFL.xlsx
import xlsx from 'xlsx';
import { pool } from '../src/db.js';
import { normalizarNombre, soloDigitos } from '../src/texto.js';

const archivo = process.argv[2];
if (!archivo) {
  console.log('Uso: node scripts/import_servidores.js /ruta/al/archivo.xlsx');
  process.exit(1);
}

const norm = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

function fechaExcelADate(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number') {
    // Fechas seriales de Excel (días desde 1899-12-30)
    const ms = Math.round((valor - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

async function main() {
  const wb = xlsx.readFile(archivo);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const filas = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: null });

  let creados = 0, omitidos = 0;

  for (const fila of filas) {
    const nombre = norm(fila['Nombre Completo']);
    if (!nombre) { omitidos++; continue; }

    await pool.query(
      `INSERT INTO servidores (nombre_completo, capitulo, celular, estado_civil, hijos_cantidad, fecha_nacimiento, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        normalizarNombre(nombre),
        norm(fila['Capítulo']),
        soloDigitos(fila['Número de Celular']),
        norm(fila['Estado Civil']),
        fila['Hijos'] !== null && fila['Hijos'] !== undefined ? parseInt(fila['Hijos'], 10) || null : null,
        fechaExcelADate(fila['Fecha de Nacimiento']),
        norm(fila['E-mail'])
      ]
    );
    creados++;
  }

  console.log(JSON.stringify({ filas_procesadas: filas.length, servidores_creados: creados, omitidos }, null, 2));
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
