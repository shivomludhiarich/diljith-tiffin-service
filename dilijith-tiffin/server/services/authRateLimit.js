import { createHash } from 'node:crypto';
import AuthRate from '../models/AuthRate.js';

export async function withinRateLimit(key, duration, maximum) {
  const bucket = Math.floor(Date.now() / duration);
  const id = createHash('sha256').update(`${key}:${bucket}`).digest('hex');
  let entry;
  try {
    entry = await AuthRate.findOneAndUpdate({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * duration) } }, { upsert: true, new: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
    entry = await AuthRate.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true });
  }
  return entry.count <= maximum;
}
