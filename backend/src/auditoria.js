import { query } from './db.js';

// Campos que NUNCA se guardan en el resumen de auditoría, aunque vengan en el body de la
// petición (contraseñas, tokens, etc.) — por seguridad, ni siquiera enmascarados.
const CAMPOS_SENSIBLES = ['password', 'password_hash', 'token', 'pin'];

function resumirBody(body) {
  if (!body || typeof body !== 'object') return '';
  const partes = [];
  for (const [clave, valor] of Object.entries(body)) {
    if (CAMPOS_SENSIBLES.includes(clave)) continue;
    if (valor === undefined || valor === null || valor === '') continue;
    const texto = Array.isArray(valor) ? `[${valor.length} elemento(s)]` : String(valor);
    partes.push(`${clave}=${texto.slice(0, 60)}`);
  }
  return partes.slice(0, 6).join(', ');
}

const ETIQUETA_METODO = { POST: 'Creó', PUT: 'Editó', DELETE: 'Eliminó' };

export function resumirAccion(req) {
  const accion = ETIQUETA_METODO[req.method] || req.method;
  const detalle = resumirBody(req.body);
  return detalle ? `${accion} · ${detalle}` : accion;
}

// Middleware global: registra cualquier POST/PUT/DELETE exitoso dentro de /api/admin.
// Se engancha a res.on('finish') para leer req.user (lo llena requireAuth más abajo en la
// cadena) y el código de estado real de la respuesta, sin bloquear ni retrasar la petición.
export function auditoriaMiddleware(req, res, next) {
  if (req.path.startsWith('/api/admin') && req.method !== 'GET' && !req.path.startsWith('/api/admin/auditoria')) {
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user) return;
      query(
        `INSERT INTO auditoria (usuario_admin_id, tipo, metodo, ruta, resumen) VALUES ($1,'accion',$2,$3,$4)`,
        [req.user.id, req.method, req.originalUrl, resumirAccion(req)]
      ).catch(e => console.error('No se pudo registrar auditoría:', e));
    });
  }
  next();
}

export async function registrarLogin(usuarioId) {
  try {
    await query(`INSERT INTO auditoria (usuario_admin_id, tipo, resumen) VALUES ($1,'login','Inicio de sesión')`, [usuarioId]);
  } catch (e) {
    console.error('No se pudo registrar el inicio de sesión en auditoría:', e);
  }
}
