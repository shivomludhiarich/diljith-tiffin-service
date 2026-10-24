import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { validateEnvironment } from './config/environment.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    validateEnvironment();
    // 1. Connect to MongoDB before starting server
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    // Start the local HTTP listener. Seeding is a separate explicit command.
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
    console.error('[Server] Startup failed. Check server configuration and database availability.');
    process.exit(1);
  }
}

startServer();
