import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'express-async-errors'; // hace que los errores en rutas async lleguen al manejador de errores, en vez de tumbar el proceso
import publicRoutes from './routes/public.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/admin.js';
import reportesRoutes from './routes/reportes.js';
import servidoresRoutes from './routes/servidores.js';
import cocinaRoutes from './routes/cocina.js';

// Red de seguridad: si algo se escapa igual, se registra pero NO se cae el servidor.
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

const app = express();

// Permite varios dominios separados por coma en CORS_ORIGIN (ej. dominio propio + subdominio de Netlify)
const origenesPermitidos = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
app.use(cors({
  origin: origenesPermitidos.includes('*') ? '*' : origenesPermitidos
}));
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api/registro', limiter);
app.use('/api/auth/login', rateLimit({ windowMs: 60 * 1000, max: 10 }));

app.get('/api/salud', (req, res) => res.json({ ok: true, servicio: 'SFL FIHNEC API' }));

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/reportes', reportesRoutes);
app.use('/api/admin/servidores', servidoresRoutes);
app.use('/api/cocina', cocinaRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API SFL FIHNEC escuchando en puerto ${PORT}`));
