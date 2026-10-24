import { connectDB } from '../server/config/db.js';
import { validateEnvironment } from '../server/config/environment.js';
let appPromise;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    validateEnvironment();
    await connectDB();
    appPromise ??= import('../server/app.js').then(module => module.default).catch(error => { appPromise = undefined; throw error; });
    const app = await appPromise;
    return app(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, message: 'Service temporarily unavailable.', database: { connected: false } }));
  }
}
