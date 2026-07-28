// Importa las graduaciones históricas de Nivel IV desde un Excel con 4 hojas
// (PROMOCION 1 a PROMOCION 4), cada una con columnas: Nombre, Identidad, fecha de graduacion.
//
// Para cada persona:
//   1. Busca primero por DNI (si el Excel trae uno).
//   2. Si no hay DNI o no lo encuentra, busca por nombre completo exacto (sin importar
//      mayúsculas/acentos/espacios de más).
//   3. Si el nombre coincide con MÁS de una persona en el sistema, no se toca — se reporta
//      para que lo revises a mano (nunca se adivina).
//   4. Si no se encuentra a nadie, se reporta como "no encontrado".
//   5. Si la persona ya tiene una inscripción en Nivel IV, se actualiza su ciclo, promoción
//      y fecha de graduación. Si no tiene, se crea la inscripción.
//
// Promoción 1 -> ciclo 1, Promoción 2 -> ciclo 2, Promoción 3 -> ciclo 3, Promoción 4 -> ciclo 4.
//
// IMPORTANTE: corre primero (o después, pero no al mismo tiempo) sincronizar_ciclo_promocion.js
// para que el ciclo EN VIVO de Nivel IV quede en #5 y no se mezcle con estos históricos (1-4).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/importar_promociones_historicas.js --aplicar
//
// Por defecto busca el archivo en backend/data/4_promociones.xlsx. Para usar otra ruta:
//   node scripts/importar_promociones_historicas.js "C:\ruta\al\archivo.xlsx" --aplicar

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aplicar = process.argv.includes('--aplicar');
const rutaArgumento = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.xlsx'));
const rutaArchivo = rutaArgumento || path.join(__dirname, '../data/4_promociones.xlsx');

const HOJAS = [
  { nombre: 'PROMOCION 1', promocion: '1', ciclo: 1 },
  { nombre: 'PROMOCION 2', promocion: '2', ciclo: 2 },
  { nombre: 'PROMOCION 3', promocion: '3', ciclo: 3 },
  { nombre: 'PROMOCION 4', promocion: '4', ciclo: 4 },
];

function normalizarClave(v) {
  return String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
function soloDigitos(v) { return String(v || '').replace(/[^\d]/g, ''); }
function excelFechaAJS(serial) {
  if (typeof serial !== 'number') return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
}

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log(`Archivo: ${rutaArchivo}\n`);

  if (!fs.existsSync(rutaArchivo)) {
    console.error(`No se encontró el archivo. Colócalo en backend/data/4_promociones.xlsx, o pasa la ruta como argumento.`);
    process.exit(1);
  }

  const { rows: nivelIVRows } = await pool.query('SELECT id FROM eventos WHERE orden = 4');
  const nivelIVId = nivelIVRows[0]?.id;
  if (!nivelIVId) { console.error('No se encontró el Nivel IV en la tabla eventos.'); process.exit(1); }

  const { rows: participantes } = await pool.query('SELECT id, nombre_completo, dni FROM participantes');
  const porDni = new Map();
  const porNombre = new Map();
  for (const p of participantes) {
    if (p.dni) porDni.set(soloDigitos(p.dni), p);
    const clave = normalizarClave(p.nombre_completo);
    if (!porNombre.has(clave)) porNombre.set(clave, []);
    porNombre.get(clave).push(p);
  }

  const wb = xlsx.readFile(rutaArchivo);
  let totalOk = 0, totalNuevo = 0, totalActualizado = 0;
  const noEncontrados = [];
  const ambiguos = [];

  for (const { nombre: hoja, promocion, ciclo } of HOJAS) {
    if (!wb.SheetNames.includes(hoja)) { console.log(`⚠️  No se encontró la hoja "${hoja}", se omite.`); continue; }
    const datos = xlsx.utils.sheet_to_json(wb.Sheets[hoja], { defval: null });
    console.log(`=== ${hoja} (${datos.length} filas) ===`);

    for (const fila of datos) {
      const nombreExcel = fila['Nombre'];
      const dniExcel = fila['Identidad'] ? soloDigitos(fila['Identidad']) : null;
      const fechaGraduacion = excelFechaAJS(fila['fecha de graduacion']);
      if (!nombreExcel) continue;

      let participante = null;
      if (dniExcel && porDni.has(dniExcel)) {
        participante = porDni.get(dniExcel);
      } else {
        const clave = normalizarClave(nombreExcel);
        const candidatos = porNombre.get(clave) || [];
        if (candidatos.length === 1) participante = candidatos[0];
        else if (candidatos.length > 1) {
          ambiguos.push(`${hoja}: "${nombreExcel}" coincide con ${candidatos.length} personas distintas — se omite, revisar a mano.`);
          continue;
        }
      }

      if (!participante) {
        noEncontrados.push(`${hoja}: "${nombreExcel}"${dniExcel ? ` (DNI ${fila['Identidad']})` : ' (sin DNI)'} — no se encontró en el sistema.`);
        continue;
      }

      const { rows: inscExistente } = await pool.query(
        'SELECT id FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
        [participante.id, nivelIVId]
      );

      if (inscExistente.length) {
        console.log(`[actualiza] #${participante.id} ${participante.nombre_completo} -> ciclo ${ciclo}, promoción ${promocion}, graduación ${fechaGraduacion}`);
        totalActualizado++;
        if (aplicar) {
          await pool.query(
            'UPDATE inscripciones SET ciclo = $1, promocion_graduacion = $2, fecha_graduacion = $3 WHERE id = $4',
            [ciclo, promocion, fechaGraduacion, inscExistente[0].id]
          );
        }
      } else {
        console.log(`[nuevo]     #${participante.id} ${participante.nombre_completo} -> ciclo ${ciclo}, promoción ${promocion}, graduación ${fechaGraduacion}`);
        totalNuevo++;
        if (aplicar) {
          await pool.query(
            `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, fecha_graduacion, origen, registrado_en)
             VALUES ($1, $2, $3, $4, $5, 'import_historico', now())`,
            [participante.id, nivelIVId, ciclo, promocion, fechaGraduacion]
          );
        }
      }
      totalOk++;
    }
    console.log('');
  }

  console.log('--- Resumen ---');
  console.log(`Encontrados y procesados: ${totalOk} (nuevos: ${totalNuevo}, actualizados: ${totalActualizado})`);
  if (ambiguos.length) {
    console.log(`\nAmbiguos (mismo nombre en 2+ personas, se omitieron):`);
    ambiguos.forEach(a => console.log('  - ' + a));
  }
  if (noEncontrados.length) {
    console.log(`\nNo encontrados en el sistema (se omitieron, revisar a mano — ${noEncontrados.length}):`);
    noEncontrados.forEach(n => console.log('  - ' + n));
  }
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Agrega --aplicar para guardar.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
