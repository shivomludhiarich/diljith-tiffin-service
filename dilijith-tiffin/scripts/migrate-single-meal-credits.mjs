import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import Subscription from '../server/models/Subscription.js';
import MealRecord from '../server/models/MealRecord.js';
import User from '../server/models/User.js';
import CreditLedger from '../server/models/CreditLedger.js';
import { previewMigration } from '../server/services/creditMigration.js';
// An exported backup is mandatory. No .env, default URI, or implicit write mode.
const args = process.argv.slice(2);
const path = args.find(a => !a.startsWith('--'));
if (!path) throw new Error('Provide a backup snapshot with subscriptions and mealRecords arrays. Default mode is preview.');
const snapshot = JSON.parse(await fs.readFile(path, 'utf8'));
const preview = previewMigration(snapshot.subscriptions, snapshot.mealRecords);
if (!args.includes('--apply')) {
  console.log(JSON.stringify(preview, null, 2));
} else {
  if (!process.env.CREDIT_MIGRATION_URI || !process.env.CREDIT_MIGRATION_DB) throw new Error('Explicit CREDIT_MIGRATION_URI and CREDIT_MIGRATION_DB are required for an approved migration.');
  const stable = value => JSON.stringify(value, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
  try {
    await mongoose.connect(process.env.CREDIT_MIGRATION_URI, { dbName: process.env.CREDIT_MIGRATION_DB, autoIndex: false });
    await CreditLedger.createIndexes();
    await MealRecord.createIndexes();
    let changed = 0;
    for (const item of preview.filter(p => p.status === 'candidate')) {
      const migrated = await mongoose.connection.transaction(async session => {
        let current = await Subscription.collection.findOne({ _id: new mongoose.Types.ObjectId(item.id) }, { session });
        if (current?.accountingVersion === 2) return;
        const original = snapshot.subscriptions.find(s => String(s._id) === item.id);
        if (!current || stable(JSON.parse(JSON.stringify(current))) !== stable(original)) throw new Error(`Subscription ${item.id} differs from backup. Export a fresh backup and review again.`);
        await User.updateOne({ _id: current.user }, { $inc: { creditRevision: 1 } }, { session });
        const records = await MealRecord.collection.find({ user: current.user }, { session }).toArray();
        const checked = previewMigration([current], records)[0];
        if (checked.status !== 'candidate') throw new Error(`Subscription ${item.id} now requires review.`);
        const mealType = current.mealTypes[0];
        await CreditLedger.create([{ user: current.user, subscription: current._id, mealType, delta: item.openingBalance,
          operation: 'migration_opening', operationKey: `migration:${item.id}`, expiresOn: current.endDate,
          reason: 'Verified single-meal opening balance; original allocation and consumption retained in subscription and backup.' }], { session });
        await Subscription.updateOne({ _id: current._id, accountingVersion: { $ne: 2 } }, { $set: item.proposed }, { session });
        for (const record of records.filter(r => String(r.subscription) === item.id)) {
          await MealRecord.updateOne({ _id: record._id }, { $set: { accountingVersion: 2, ...(record.status === 'Cancelled' ? {} : { servingKey: `${record.user}:${record.date}:${record.mealType}` }) } }, { session });
        }
        return true;
      });
      if (migrated) changed++;
    }
    console.log(`Migrated ${changed} verified single-meal subscriptions. Multi-meal/review records were not changed.`);
  } finally { await mongoose.disconnect(); }
}
