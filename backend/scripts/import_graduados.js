// Importa la lista de graduados de SFL IV y marca que completaron los niveles 1 al 4.
// No borra ni sobrescribe inscripciones que ya existan; solo agrega las que falten.
// Las inscripciones agregadas por este script quedan con ciclo = 0 (histórico), para que
// NO se cuenten como parte del "ciclo actual" de cada nivel.
//
// Uso: node scripts/import_graduados.js /ruta/al/Graduados_SFL_IV.xlsx
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';
import { normalizarNombre, soloDigitos } from '../src/texto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archivo = process.argv[2];
if (!archivo) {
  console.log('Uso: node scripts/import_graduados.js /ruta/al/archivo.xlsx');
  process.exit(1);
}

const municipioADepto = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'municipio_departamento.json'), 'utf8')
);

const norm = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

function tituloCase(s) {
  const conectores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'en', 'a']);
  return String(s).trim().toLowerCase().split(/\s+/)
    .map((p, i) => (i > 0 && conectores.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function main() {
  const wb = xlsx.readFile(archivo);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const filasCrudas = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Busca la fila de encabezados real (la que empieza con "No." y contiene "Nombre")
  const idxEncabezado = filasCrudas.findIndex(f => f[0] === 'No.' && f.includes('Nombre'));
  if (idxEncabezado === -1) throw new Error('No se encontró la fila de encabezados en el Excel.');
  const encabezados = filasCrudas[idxEncabezado];
  const filas = filasCrudas.slice(idxEncabezado + 1)
    .filter(f => f.some(v => v !== null && v !== undefined && String(v).trim() !== ''))
    .map(f => Object.fromEntries(encabezados.map((h, i) => [h, f[i] !== undefined ? f[i] : null])));

  const eventosRes = await pool.query('SELECT id, orden FROM eventos ORDER BY orden');
  const eventoIdPorOrden = Object.fromEntries(eventosRes.rows.map(e => [e.orden, e.id]));

  let creados = 0, existentesActualizados = 0, omitidos = 0;
  let inscripcionesAgregadas = 0, yaEstaban = 0;

  for (const fila of filas) {
    const nombre = norm(fila['Nombre']);
    const dni = soloDigitos(fila['Identidad']);
    if (!nombre || !dni) { omitidos++; continue; }

    const ciudad = norm(fila['Ciudad']);
    const municipio = ciudad ? tituloCase(ciudad) : null;
    const departamento = municipio ? (municipioADepto[municipio] || null) : null;
    const anioGraduacion = fila['Año Graduación'] ? String(fila['Año Graduación']).trim() : null;

    const existe = await pool.query('SELECT id FROM participantes WHERE dni = $1', [dni]);
    let participanteId;

    if (existe.rows[0]) {
      participanteId = existe.rows[0].id;
      existentesActualizados++;
    } else {
      const ins = await pool.query(
        `INSERT INTO participantes (nombre_completo, dni, celular, capitulo, zona, departamento, municipio, cargo_fihnec)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          normalizarNombre(nombre), dni, soloDigitos(fila['Celular']),
          norm(fila['Capitulo']) ? normalizarNombre(fila['Capitulo']) : null,
          norm(fila['Zona']) ? tituloCase(fila['Zona']) : null,
          departamento, municipio,
          norm(fila['Cargo'])
        ]
      );
      participanteId = ins.rows[0].id;
      creados++;
    }

    // Marca los niveles 1 al 4 como completados (si no lo estaban ya)
    for (const orden of [1, 2, 3, 4]) {
      const yaInscrito = await pool.query(
        'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
        [participanteId, eventoIdPorOrden[orden]]
      );
      if (yaInscrito.rows[0]) {
        // Si es el nivel 4 y no tiene promoción registrada, se la agregamos
        if (orden === 4 && anioGraduacion) {
          await pool.query(
            'UPDATE inscripciones SET promocion_graduacion = COALESCE(promocion_graduacion, $1) WHERE id = $2',
            [anioGraduacion, yaInscrito.rows[0].id]
          );
        }
        yaEstaban++;
        continue;
      }
      await pool.query(
        `INSERT INTO inscripciones (participante_id, evento_id, origen, ciclo, promocion_graduacion)
         VALUES ($1,$2,'importado',0,$3)`,
        [participanteId, eventoIdPorOrden[orden], orden === 4 ? anioGraduacion : null]
      );
      inscripcionesAgregadas++;
    }
  }

  console.log(JSON.stringify({
    filas_procesadas: filas.length,
    participantes_nuevos_creados: creados,
    participantes_existentes_actualizados: existentesActualizados,
    omitidos_sin_nombre_o_dni: omitidos,
    inscripciones_nuevas_agregadas: inscripcionesAgregadas,
    inscripciones_que_ya_existian: yaEstaban
  }, null, 2));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
