// Corrige (o crea, si no existe) la inscripción en los 4 niveles del SFL para la Promoción 4,
// usando el Excel con las 4 fechas por persona. Todos van con ciclo 4 y promoción 4.
//
// Para cada nivel de cada persona:
//   - Si ya tiene inscripción en ese nivel: se corrige fecha, ciclo y promoción (se archiva
//     el valor anterior en el historial antes, si había algo real que preservar).
//   - Si NO tiene inscripción en ese nivel: se crea.
//   - EXCEPCIÓN de seguridad: si está HOY activa en el ciclo en vivo de ese nivel específico,
//     NO se toca — se reporta aparte (lección aprendida con el caso de Héctor Hernandez).
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_promocion4_todos_niveles.js --aplicar
//
// Por defecto busca el archivo en backend/data/reporte_sfl_promocion4.xlsx.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aplicar = process.argv.includes('--aplicar');
const rutaArgumento = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.xlsx'));
const rutaArchivo = rutaArgumento || path.join(__dirname, '../data/reporte_sfl_promocion4.xlsx');

const CICLO = 4;
const PROMOCION = '4';

// Nivel -> { columna del Excel, fecha ya conocida }
const NIVELES = [
  { orden: 1, columna: 'SFL I', fecha: '2026-02-08' },
  { orden: 2, columna: 'SFL II', fecha: '2026-03-15' },
  { orden: 3, columna: 'SFL III', fecha: '2026-04-12' },
  { orden: 4, columna: 'SFL IV', fecha: '2026-06-21' }
];

function normalizarClave(v) {
  return String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
function soloDigitos(v) { return String(v || '').replace(/[^\d]/g, ''); }

async function main() {
  console.log(aplicar ? '⚠️  Modo APLICAR: se van a guardar los cambios.' : 'Modo SIMULACIÓN (no se guarda nada). Corre con --aplicar para guardar.');
  console.log(`Archivo: ${rutaArchivo}\n`);

  if (!fs.existsSync(rutaArchivo)) {
    console.error('No se encontró el archivo. Colócalo en backend/data/reporte_sfl_promocion4.xlsx, o pasa la ruta como argumento.');
    process.exit(1);
  }

  const { rows: eventos } = await pool.query('SELECT id, orden, ciclo_actual FROM eventos ORDER BY orden');
  const eventoPorOrden = new Map(eventos.map(e => [e.orden, e]));

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
  const datos = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  let actualizados = 0, creados = 0, sinCambio = 0;
  const noEncontrados = [];
  const ambiguos = [];
  const posiblesDobles = [];

  for (const fila of datos) {
    const nombreExcel = fila['Nombre Completo'];
    if (!nombreExcel) continue;

    const dniExcel = fila['DNI'] ? soloDigitos(fila['DNI']) : null;
    let participante = null;
    if (dniExcel && porDni.has(dniExcel)) {
      participante = porDni.get(dniExcel);
    } else {
      const candidatos = porNombre.get(normalizarClave(nombreExcel)) || [];
      if (candidatos.length === 1) participante = candidatos[0];
      else if (candidatos.length > 1) {
        ambiguos.push(`"${nombreExcel}" coincide con ${candidatos.length} personas distintas — se omite, revisar a mano.`);
        continue;
      }
    }

    if (!participante) {
      noEncontrados.push(`"${nombreExcel}"${dniExcel ? ` (DNI ${fila['DNI']})` : ' (sin DNI)'} — no se encontró en el sistema.`);
      continue;
    }

    for (const { orden, fecha } of NIVELES) {
      const evento = eventoPorOrden.get(orden);
      const { rows: inscExistente } = await pool.query(
        'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
        [participante.id, evento.id]
      );

      if (!inscExistente.length) {
        console.log(`[${participante.nombre_completo}] (#${participante.id}) -> se CREA Nivel ${orden}: fecha ${fecha}, ciclo ${CICLO}, promoción ${PROMOCION}`);
        if (aplicar) {
          await pool.query(
            `INSERT INTO inscripciones (participante_id, evento_id, ciclo, promocion_graduacion, fecha_graduacion, registrado_en, origen)
             VALUES ($1, $2, $3, $4, $5, $6, 'import_historico')`,
            [participante.id, evento.id, CICLO, PROMOCION, fecha, `${fecha} 00:00:00`]
          );
        }
        creados++;
        continue;
      }

      const anterior = inscExistente[0];

      if (anterior.ciclo === evento.ciclo_actual) {
        posiblesDobles.push(
          `${participante.nombre_completo} (#${participante.id}, DNI ${participante.dni}) -> Nivel ${orden} está ACTIVO hoy en el ciclo en vivo (#${evento.ciclo_actual}). ` +
          `El Excel indica Promoción 4 el ${fecha}. Revisar a mano — probablemente repitió el nivel.`
        );
        continue;
      }

      const yaCorrecto = anterior.ciclo === CICLO
        && anterior.registrado_en && anterior.registrado_en.toISOString().slice(0, 10) === fecha
        && anterior.promocion_graduacion === PROMOCION
        && anterior.fecha_graduacion && anterior.fecha_graduacion.toISOString().slice(0, 10) === fecha;

      if (yaCorrecto) { sinCambio++; continue; }

      console.log(`[${participante.nombre_completo}] (#${participante.id}) -> Nivel ${orden}: fecha ${fecha}, ciclo ${CICLO}, promoción ${PROMOCION}`);
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
          [`${fecha} 00:00:00`, CICLO, PROMOCION, fecha, anterior.id]
        );
      }
      actualizados++;
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Actualizados: ${actualizados}`);
  console.log(`Creados: ${creados}`);
  console.log(`Ya estaban correctos (sin cambio): ${sinCambio}`);
  if (posiblesDobles.length) {
    console.log(`\n⚠️  POSIBLES DOBLES REGISTROS — activos hoy, NO se tocaron (${posiblesDobles.length}):`);
    posiblesDobles.forEach(p => console.log('  - ' + p));
  }
  if (ambiguos.length) {
    console.log(`\nAmbiguos (se omitieron — ${ambiguos.length}):`);
    ambiguos.forEach(a => console.log('  - ' + a));
  }
  if (noEncontrados.length) {
    console.log(`\nNo encontrados en el sistema (se omitieron — ${noEncontrados.length}):`);
    noEncontrados.forEach(n => console.log('  - ' + n));
  }
  console.log('');
  console.log(aplicar ? '✅ Cambios guardados.' : 'Nada se guardó todavía. Agrega --aplicar para guardar.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
