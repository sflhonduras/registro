// Corrige la fecha de registro, ciclo (#1) y promoción (1) de la inscripción al Nivel III para
// las personas de la Promoción I, usando el Excel de asistencia. La fecha de graduación se fija
// igual a la fecha de registro (mismo criterio usado para Nivel I).
//
// SEGURIDAD (lección aprendida con el caso de Héctor Hernandez): si alguien de este Excel
// resulta estar HOY activo en el ciclo en vivo de Nivel III (es decir, se re-registró
// recientemente y está repitiendo el nivel), NO se sobrescribe automáticamente — se reporta
// aparte para revisión manual, para no perder su registro actual como pasó la vez pasada.
//
// Antes de sobrescribir (en los casos que sí se tocan), se archiva el valor anterior en el
// historial, por si hiciera falta consultarlo después.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_fechas_nivel3_promocion1.js --aplicar
//
// Por defecto busca el archivo en backend/data/fecha_promo1_sfl3.xlsx.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aplicar = process.argv.includes('--aplicar');
const rutaArgumento = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.xlsx'));
const rutaArchivo = rutaArgumento || path.join(__dirname, '../data/fecha_promo1_sfl3.xlsx');

const CICLO = 1;
const PROMOCION = '1';

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
    console.error('No se encontró el archivo. Colócalo en backend/data/fecha_promo1_sfl3.xlsx, o pasa la ruta como argumento.');
    process.exit(1);
  }

  const { rows: nivel3Rows } = await pool.query('SELECT id, ciclo_actual FROM eventos WHERE orden = 3');
  const nivel3 = nivel3Rows[0];

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

  let actualizados = 0, sinCambio = 0;
  const noEncontrados = [];
  const ambiguos = [];
  const sinInscripcionNivel3 = [];
  const posiblesDobles = [];

  for (const fila of datos) {
    const nombreExcel = fila['Nombre'];
    if (!nombreExcel) continue;

    const fecha = excelFechaAJS(fila['Fecha']);
    if (!fecha) { ambiguos.push(`"${nombreExcel}" -> sin fecha válida en el Excel.`); continue; }

    const dniExcel = fila['Identidad'] ? soloDigitos(fila['Identidad']) : null;
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
      noEncontrados.push(`"${nombreExcel}"${dniExcel ? ` (DNI ${fila['Identidad']})` : ' (sin DNI)'} — no se encontró en el sistema.`);
      continue;
    }

    const { rows: inscExistente } = await pool.query(
      'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante.id, nivel3.id]
    );

    if (!inscExistente.length) {
      sinInscripcionNivel3.push(`${participante.nombre_completo} (#${participante.id}) — no tiene inscripción de Nivel III para corregir.`);
      continue;
    }
    const anterior = inscExistente[0];

    // Protección: si esta persona está HOY activa en el ciclo en vivo, no la tocamos aquí.
    if (anterior.ciclo === nivel3.ciclo_actual) {
      posiblesDobles.push(
        `${participante.nombre_completo} (#${participante.id}, DNI ${participante.dni}) -> está ACTIVA hoy en el ciclo en vivo (#${nivel3.ciclo_actual}) de Nivel III. ` +
        `El Excel indica que también hizo Nivel III el ${fecha} (Promoción I). Revisar a mano — probablemente repitió el nivel.`
      );
      continue;
    }

    const yaCorrecto = anterior.ciclo === CICLO
      && anterior.registrado_en && anterior.registrado_en.toISOString().slice(0, 10) === fecha
      && anterior.promocion_graduacion === PROMOCION
      && anterior.fecha_graduacion && anterior.fecha_graduacion.toISOString().slice(0, 10) === fecha;

    if (yaCorrecto) {
      sinCambio++;
      continue;
    }

    console.log(`[${participante.nombre_completo}] (#${participante.id}) -> Nivel III: fecha ${fecha}, ciclo ${CICLO}, promoción ${PROMOCION}, graduación ${fecha}`);
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

  console.log('\n--- Resumen ---');
  console.log(`Actualizados: ${actualizados}`);
  console.log(`Ya estaban correctos (sin cambio): ${sinCambio}`);
  if (posiblesDobles.length) {
    console.log(`\n⚠️  POSIBLES DOBLES REGISTROS — están activos hoy, NO se tocaron (${posiblesDobles.length}):`);
    posiblesDobles.forEach(p => console.log('  - ' + p));
  }
  if (sinInscripcionNivel3.length) {
    console.log(`\nSin inscripción de Nivel III (no se pudo corregir — ${sinInscripcionNivel3.length}):`);
    sinInscripcionNivel3.forEach(s => console.log('  - ' + s));
  }
  if (ambiguos.length) {
    console.log(`\nAmbiguos (se omitieron, revisar a mano — ${ambiguos.length}):`);
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
