import { connectDB } from '../server/config/db.js';
import { validateEnvironment } from '../server/config/environment.js';
let appPromise;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let stage = 'environment';
  try {
    validateEnvironment();
    stage = 'database';
    await connectDB();
    stage = 'application';
    appPromise ??= import('../server/app.js').then(module => module.default).catch(error => { appPromise = undefined; throw error; });
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    // Only validation messages from our own fixed allowlist may reach logs.
    // Database and module errors may contain credentials or private paths.
    const configurationMessages = new Set([
      'Configure a strong production JWT_SECRET.', 'Configure MONGODB_URI.',
      'Configure ALLOWED_ORIGIN.', 'ALLOWED_ORIGIN must be an exact HTTPS origin.',
    ]);
    const detail = stage === 'environment' && configurationMessages.has(error?.message)
      ? error.message : 'Check configuration and service availability.';
    console.error(`[API initialization: ${stage}] ${detail}`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, message: 'Service temporarily unavailable.', database: { connected: false } }));
  }
}
