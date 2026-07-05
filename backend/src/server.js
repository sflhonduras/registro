import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/admin.js';

dotenv.config();
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API SFL FIHNEC escuchando en puerto ${PORT}`));
