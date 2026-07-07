// Importa la hoja "BD" del Excel entregado hacia las tablas participantes / inscripciones.
// Uso: node scripts/import_excel.js /ruta/al/Base_de_Datos_Actualizada_SFL.xlsx
import xlsx from 'xlsx';
import { pool } from '../src/db.js';

const archivo = process.argv[2];
if (!archivo) {
  console.log('Uso: node scripts/import_excel.js /ruta/al/archivo.xlsx');
  process.exit(1);
}

const norm = v => (v === undefined || v === null || v === '' ? null : String(v).trim());
const soloDigitos = v => (v === undefined || v === null ? null : String(v).replace(/[^\d]/g, ''));
const registrado = v => {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'registrado' || s === 'si' || s === 'sí';
};
const toInt = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

async function main() {
  const wb = xlsx.readFile(archivo);
  const sheet = wb.Sheets['BD'];
  if (!sheet) throw new Error('No se encontró la hoja "BD" en el archivo.');
  const filas = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const eventosRes = await pool.query('SELECT id, orden FROM eventos ORDER BY orden');
  const eventoIdPorOrden = Object.fromEntries(eventosRes.rows.map(e => [e.orden, e.id]));

  const dnisVistos = new Set();
  let creados = 0, omitidosSinDni = 0, omitidosDuplicados = 0, inscripcionesCreadas = 0;

  for (const fila of filas) {
    const dni = soloDigitos(fila['Número de Identidad (DNI)']);
    const nombre = norm(fila['Nombre completo']);
    if (!dni || !nombre) { omitidosSinDni++; continue; }
    if (dnisVistos.has(dni)) { omitidosDuplicados++; continue; }
    dnisVistos.add(dni);

    const existe = await pool.query('SELECT id FROM participantes WHERE dni = $1', [dni]);
    let participanteId;
    if (existe.rows[0]) {
      participanteId = existe.rows[0].id;
    } else {
      const ins = await pool.query(
        `INSERT INTO participantes
          (nombre_completo, dni, celular, capitulo, zona, departamento, municipio, cargo_fihnec,
           estado_civil, hijos_cantidad, comparte_testimonio, tiempo_comparte_testimonio,
           ha_recibido_sael, cantidad_saeles, contacto_emergencia_nombre, contacto_emergencia_telefono, pin, observacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          nombre, dni,
          norm(fila['Número de Celular']),
          norm(fila['Capítulo al que pertenece']),
          norm(fila['Zona']),
          norm(fila['Departamento']),
          norm(fila['Municipio']),
          norm(fila['Cargo en FIHNEC']),
          norm(fila['Estado Civil']),
          toInt(fila['Hijos (Cantidad)']),
          norm(fila['¿Comparte Testimonio?']),
          norm(fila['¿Hace cuánto tiempo comparte testimonio? ']),
          norm(fila['¿Ha recibido SAEL?']),
          toInt(fila['¿Cuántos SAELES a recibido?']),
          norm(fila['Nombre del contacto de emergencia']),
          norm(fila['Número telefónico ']),
          norm(fila['PIN']),
          norm(fila['Observacion'])
        ]
      );
      participanteId = ins.rows[0].id;
      creados++;
    }

    const estadoPorOrden = { 1: fila['SFL 1'], 2: fila['SFL 2'], 3: fila['SFL 3'], 4: fila['SFL 4'] };
    for (const orden of [1, 2, 3, 4]) {
      if (registrado(estadoPorOrden[orden])) {
        try {
          await pool.query(
            'INSERT INTO inscripciones (participante_id, evento_id, origen) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [participanteId, eventoIdPorOrden[orden], 'importado']
          );
          inscripcionesCreadas++;
        } catch (e) { /* ignora duplicados */ }
      }
    }
  }

  console.log(JSON.stringify({
    filas_procesadas: filas.length,
    participantes_creados: creados,
    omitidos_sin_dni_o_nombre: omitidosSinDni,
    omitidos_duplicados_en_archivo: omitidosDuplicados,
    inscripciones_creadas: inscripcionesCreadas
  }, null, 2));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
