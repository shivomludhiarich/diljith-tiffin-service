import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedInitialDataIfEmpty } from './utils/seedData.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MongoDB before starting server
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    // 2. Seed initial admin & demo accounts if database is empty
    await seedInitialDataIfEmpty();

    // 3. Start Express server
    const server = app.listen(PORT, () => {
      console.log(`[Server] Dilijith Tiffin Service backend running on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });

    const shutdown = async () => {
      console.log('[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server] Fatal startup error:', error.message);
    process.exit(1);
  }
}

startServer();
