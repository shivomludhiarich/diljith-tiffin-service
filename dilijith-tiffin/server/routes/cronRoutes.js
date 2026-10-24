import express from 'express';
import { timingSafeEqual, createHash } from 'node:crypto';
import { settleDueMeals } from '../services/automaticConsumption.js';
const router = express.Router();
router.get('/consume-meals', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ ok: false, message: 'Scheduler is not configured.' });
  const digest = value => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest(`Bearer ${secret}`))) return res.status(401).json({ ok: false });
  try { res.json({ ok: true, ...await settleDueMeals() }); }
  catch { console.error('[Meal accounting] Scheduled processing failed.'); res.status(503).json({ ok: false, message: 'Meal processing failed.' }); }
});
export default router;
