import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../server/config/db.js';
import { seedInitialDataIfEmpty } from '../server/utils/seedData.js';
if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.ENABLE_DEMO_SEED !== 'true') {
  throw new Error('Development seeding requires ENABLE_DEMO_SEED=true and is disabled on Vercel and in production.');
}
try {
  await connectDB();
  await seedInitialDataIfEmpty();
} catch {
  console.error('Development seeding failed. Check the development database and seed configuration.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
