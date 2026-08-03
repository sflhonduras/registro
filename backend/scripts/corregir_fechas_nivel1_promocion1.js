// Corrige la fecha de registro real (2023) y el ciclo (#1) de la inscripción al Nivel I para
// las personas de la Promoción I, usando la hoja de asistencia consolidada. Cada persona tiene
// una sola fecha marcada de las 4 posibles (05 feb, 07 may, 16 jul, 13 ago 2023) — esa es su
// fecha real de registro al Nivel I.
//
// Antes de sobrescribir, se archiva el valor anterior en el historial (igual que el resto del
// sistema), por si hiciera falta consultarlo después.
//
// Los casos con 0 o 2+ fechas marcadas NO se tocan — se listan aparte para revisión manual.
//
// Modo SIMULACIÓN por defecto. Para aplicar:
//   node scripts/corregir_fechas_nivel1_promocion1.js --aplicar
//
// Por defecto busca el archivo en backend/data/fechas_promocion_I_2023.xlsx.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aplicar = process.argv.includes('--aplicar');
const rutaArgumento = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.xlsx'));
const rutaArchivo = rutaArgumento || path.join(__dirname, '../data/fechas_promocion_I_2023.xlsx');

const CICLO = 1;
const PROMOCION = '1';
const COLUMNAS_FECHA = {
  'SFL I - 05 FEB 2023': '2023-02-05',
  'SFL I - 07 MAY 2023': '2023-05-07',
  'SFL I - 16 JUL 2023': '2023-07-16',
  'SFL I - 13 AGO 2023': '2023-08-13'
};

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
    console.error('No se encontró el archivo. Colócalo en backend/data/fechas_promocion_I_2023.xlsx, o pasa la ruta como argumento.');
    process.exit(1);
  }

  const { rows: nivel1Rows } = await pool.query('SELECT id FROM eventos WHERE orden = 1');
  const nivel1Id = nivel1Rows[0]?.id;

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
  const sinInscripcionNivel1 = [];

  for (const fila of datos) {
    const nombreExcel = fila['Nombre'];
    if (!nombreExcel) continue; // fila de totales u otra basura al final

    const marcadas = Object.keys(COLUMNAS_FECHA).filter(c => fila[c]);
    if (marcadas.length !== 1) {
      ambiguos.push(`"${nombreExcel}" -> ${marcadas.length === 0 ? 'sin ninguna fecha marcada' : marcadas.join(' + ')}`);
      continue;
    }
    const fecha = COLUMNAS_FECHA[marcadas[0]];

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
      [participante.id, nivel1Id]
    );

    if (!inscExistente.length) {
      sinInscripcionNivel1.push(`${participante.nombre_completo} (#${participante.id}) — no tiene inscripción de Nivel I para corregir.`);
      continue;
    }
    const anterior = inscExistente[0];

    const yaCorrecto = anterior.ciclo === CICLO
      && anterior.registrado_en && anterior.registrado_en.toISOString().slice(0, 10) === fecha
      && anterior.promocion_graduacion === PROMOCION
      && anterior.fecha_graduacion && anterior.fecha_graduacion.toISOString().slice(0, 10) === fecha;

    if (yaCorrecto) {
      sinCambio++;
      continue;
    }

    console.log(`[${participante.nombre_completo}] (#${participante.id}) -> Nivel I: fecha ${fecha}, ciclo ${CICLO}, promoción ${PROMOCION}, graduación ${fecha}`);
    if (aplicar) {
      // Se archiva el estado anterior si tenía algo real que preservar.
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
  if (sinInscripcionNivel1.length) {
    console.log(`\nSin inscripción de Nivel I (no se pudo corregir, revisar a mano — ${sinInscripcionNivel1.length}):`);
    sinInscripcionNivel1.forEach(s => console.log('  - ' + s));
  }
  if (ambiguos.length) {
    console.log(`\nAmbiguos (0 o 2+ fechas marcadas, o nombre repetido — se omitieron, revisar a mano — ${ambiguos.length}):`);
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
