import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });

  const { rows } = await query('SELECT * FROM usuarios_admin WHERE email = $1 AND activo = TRUE', [email.toLowerCase().trim()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas.' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas.' });

  const token = signToken(user);
  res.json({ token, usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

export default router;
