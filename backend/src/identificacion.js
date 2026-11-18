// Identificación de participantes: DNI hondureño (13 dígitos), pasaporte (extranjeros) o
// código interno de menores (MEN-00001). Todo se guarda en la columna participantes.dni.
// Archivo aparte a propósito: texto.js no se toca.
import { soloDigitos } from './texto.js';

// ¿El valor trae letras? Entonces es un pasaporte (el DNI nunca lleva letras).
export function esPasaporte(valor) {
  return /[A-Za-z]/.test(String(valor || ''));
}

// Normaliza lo que la persona escribe: pasaporte → MAYÚSCULAS sin espacios ni símbolos;
// DNI → solo dígitos. Se usa SIEMPRE antes de buscar en la base de datos.
export function normalizarIdentificacion(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  if (esPasaporte(texto)) return texto.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return soloDigitos(texto) || texto;
}

export const validarPasaporte = (v) => /^[A-Z0-9]{5,20}$/.test(String(v || ''));
export const validarDniHn = (v) => /^\d{13}$/.test(String(v || ''));

export function validarFechaNacimiento(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
  const f = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(f.getTime())) return false;
  const hoy = new Date();
  return f <= hoy && f.getUTCFullYear() >= 1900 && f.toISOString().slice(0, 10) === valor;
}
