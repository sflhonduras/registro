// Corre las migraciones incrementales dentro de /migrations, en orden.
// Es seguro correr esto varias veces.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const carpeta = path.join(__dirname, '..', 'migrations');
  const archivos = fs.readdirSync(carpeta).filter(f => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    console.log(`Aplicando ${archivo}...`);
    await pool.query(sql);
  }
  console.log('Todas las migraciones se aplicaron correctamente.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
