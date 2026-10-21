import express from 'express';
import { isDbConnected, getDbState } from '../config/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const dbConnected = isDbConnected();
  const dbState = getDbState();

  const status = dbConnected ? 200 : 503;
  res.status(status).json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    server: 'online',
    database: {
      status: dbState,
      connected: dbConnected,
    },
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

export default router;
