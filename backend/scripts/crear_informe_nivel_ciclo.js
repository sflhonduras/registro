// Crea (si no existe) Y congela el informe de cierre de un nivel en un CICLO específico.
// Sirve para ciclos que ya terminaron (el ciclo actual del nivel ya avanzó).
//
// Uso: node scripts/crear_informe_nivel_ciclo.js <orden> <ciclo>
// Ej.: node scripts/crear_informe_nivel_ciclo.js 4 5   (Nivel IV, ciclo 5)
import { obtenerOCrearInforme, congelarInformesDeNivel } from '../src/informesCierre.js';
import { pool, query } from '../src/db.js';

async function main() {
  const orden = parseInt(process.argv[2], 10);
  const ciclo = parseInt(process.argv[3], 10);
  if (!orden || !ciclo) {
    console.error('Uso: node scripts/crear_informe_nivel_ciclo.js <orden> <ciclo>\nEj.: node scripts/crear_informe_nivel_ciclo.js 4 5');
    process.exit(1);
  }
  const informe = await obtenerOCrearInforme(orden, ciclo);
  console.log('Informe:', { token: informe.token, congelado: informe.congelado });
  await congelarInformesDeNivel(orden);
  const { rows } = await query(
    'SELECT token, congelado, congelado_en FROM informes_cierre_nivel WHERE evento_orden = $1 AND ciclo = $2',
    [orden, ciclo]
  );
  console.log('Después de congelar:', rows[0]);
  console.log('\nEnlace público: https://sflhonduras.com/informe/' + rows[0].token);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
