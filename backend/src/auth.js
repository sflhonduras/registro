import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    SECRET,
    { expiresIn: '12h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado. Falta token.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// Se mantiene por compatibilidad con rutas que todavía la usan tal cual.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    next();
  };
}

// Solo el Super Administrador puede tocar Usuarios, Auditoría y Mantenimiento — ni siquiera
// un Administrador con todos los permisos configurados llega aquí.
export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
  if (req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Solo el Super Administrador puede hacer esto.' });
  }
  next();
}

// 'Consulta' ya no ve todo el sistema — se reduce a estos 4 módulos fijos, siempre de solo
// lectura, sin importar qué se pida.
const MODULOS_CONSULTA_FIJO = ['estadisticas', 'reportes', 'inventario', 'transporte'];

// 'Estandar' es un paquete FIJO, igual para todos los que tengan este rol — no se configura
// persona por persona.
const PRESET_ESTANDAR = { servidores: 'consulta', inventario: 'edicion', transporte: 'edicion' };

// Módulos de solo lectura donde 'registro' también entra (para poder VER la lista antes de
// usar sus checkboxes especiales) — la edición real de 'registro' se controla aparte, en
// las rutas puntuales de admin.js (el checkbox "Registrado" y "Imprimir etiqueta").
const MODULOS_CONSULTA_REGISTRO = ['participantes', 'diplomas'];

// Comportamiento por rol:
//   - 'super_admin' -> siempre pasa, sin excepción, en cualquier módulo.
//   - 'admin'       -> el Super Administrador le configura, módulo por módulo, si ve o edita
//                      (usa la tabla permisos_modulo, igual que antes usaba 'estandar').
//   - 'consulta'    -> solo lectura, y solo en los 4 módulos fijos de arriba.
//   - 'estandar'    -> paquete fijo (servidores=consulta, inventario=edición, transporte=edición).
//   - 'registro'    -> lectura en participantes/diplomas, y acceso completo a inventario;
//                      la edición puntual de participantes (checkbox) se resuelve en su ruta.
//   - 'cocina'      -> bloqueado, tiene su propia pantalla aparte.
export function requireModulo(modulo, nivelMinimo = 'consulta') {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
    const rol = req.user.rol;

    if (rol === 'super_admin') return next();

    if (rol === 'consulta') {
      if (nivelMinimo === 'consulta' && MODULOS_CONSULTA_FIJO.includes(modulo)) return next();
      return res.status(403).json({ error: 'No tienes acceso a esta sección.' });
    }

    if (rol === 'estandar') {
      const nivel = PRESET_ESTANDAR[modulo];
      if (!nivel) return res.status(403).json({ error: 'No tienes acceso a esta sección.' });
      if (nivelMinimo === 'edicion' && nivel !== 'edicion') {
        return res.status(403).json({ error: 'Solo tienes acceso de consulta a esta sección.' });
      }
      return next();
    }

    if (rol === 'registro') {
      if (modulo === 'inventario') return next(); // acceso completo, ver y editar
      if (nivelMinimo === 'consulta' && MODULOS_CONSULTA_REGISTRO.includes(modulo)) return next();
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }

    if (rol === 'admin') {
      try {
        const { rows } = await query(
          'SELECT nivel FROM permisos_modulo WHERE usuario_admin_id = $1 AND modulo = $2',
          [req.user.id, modulo]
        );
        const permiso = rows[0];
        if (!permiso) return res.status(403).json({ error: 'No tienes permiso para acceder a esta sección.' });
        if (nivelMinimo === 'edicion' && permiso.nivel !== 'edicion') {
          return res.status(403).json({ error: 'Solo tienes acceso de consulta a esta sección, no puedes editar.' });
        }
        return next();
      } catch (e) {
        console.error('Error verificando permisos de módulo:', e);
        return res.status(500).json({ error: 'Error interno verificando permisos.' });
      }
    }

    return res.status(403).json({ error: 'No tienes permiso para acceder a esta sección.' });
  };
}

// Permiso especial y muy puntual: el checkbox "Registrado" (asistencia presencial) en
// Participantes. Lo puede tocar cualquiera con edición en 'participantes' (admin
// configurado, super_admin), Y TAMBIÉN el rol 'registro' — aunque 'registro' no tiene
// edición general sobre participantes, esta acción específica sí se le permite.
export function requireEditarPresencial(req, res, next) {
  if (req.user?.rol === 'registro') return next();
  return requireModulo('participantes', 'edicion')(req, res, next);
}
