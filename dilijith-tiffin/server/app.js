import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Explicit CORS allowlist. In dev the Vite origin is always allowed.
// Set ALLOWED_ORIGIN in production .env to your deployed frontend URL.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin header (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin '${origin}' is not allowed.`));
  },
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ ok: false, message: `Route ${req.originalUrl} not found.` });
  }
  next();
});

// Central error handler
app.use(errorHandler);

export default app;
