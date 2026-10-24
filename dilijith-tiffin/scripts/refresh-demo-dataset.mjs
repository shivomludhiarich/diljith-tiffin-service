import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import User from '../server/models/User.js';
import Subscription from '../server/models/Subscription.js';
import MealRecord from '../server/models/MealRecord.js';
import CreditLedger from '../server/models/CreditLedger.js';
import CreditAdjustment from '../server/models/CreditAdjustment.js';
import Activity from '../server/models/Activity.js';
import { todayStr, addDays } from '../src/utils/dates.js';

const marker = 'dts-current-schema-demo-v1';
const oldEmails = ['priya.sharma@gmail.com', 'rohan.mehta@outlook.com', 'ananya.iyer@gmail.com', 'vikram.reddy@gmail.com', 'meera.nair@yahoo.com', 'rahul.verma@gmail.com', 'sneha.kulkarni@gmail.com', 'karthik.nambiar@gmail.com', 'divya.menon@gmail.com', 'amit.patel@gmail.com', 'neha.agarwal@gmail.com'];
const selector = { role: 'user', $or: [{ email: { $in: oldEmails } }, { notes: marker }, { name: { $in: ['Anita Roy', 'Wannabe Admin'] }, email: { $exists: false } }] };
const scenarios = [
  { name: 'Demo Asha — All Meals', phone: '+919000001001', email: 'asha@example.test', plans: [['breakfast', 10, 2], ['lunch', 20, 2], ['dinner', 12, 1]] },
  { name: 'Demo Ravi — Expiring', phone: '+919000001002', email: 'ravi@example.test', plans: [['dinner', 6, 1]], end: 3, start: -25 },
  { name: 'Demo Meera — Exhausted', phone: '+919000001003', email: 'meera@example.test', plans: [['lunch', 3, 3]] },
  { name: 'Demo Kabir — Expired', phone: '+919000001004', email: 'kabir@example.test', plans: [['breakfast', 8, 2]], end: -5, start: -35 },
  { name: 'Demo Tara — New Customer', phone: '+919000001005', email: 'tara@example.test', plans: [], noAddress: true },
];

dns.setServers(['8.8.8.8', '1.1.1.1']);
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'dilijith_tiffin', autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const obsolete = await User.find(selector).lean();
  const ids = obsolete.map(u => u._id);
  const oldSubs = await Subscription.find({ user: { $in: ids } }).lean();
  console.log(JSON.stringify({ database: db.databaseName, removeDemoUsers: obsolete.map(u => u.name), removeSubscriptions: oldSubs.length, preserveUsers: (await User.find({ _id: { $nin: ids } }).lean()).map(u => u.name), create: scenarios.map(s => s.name) }, null, 2));
  if (!process.argv.includes('--apply')) process.exitCode = 0;
  else {
    // Backup raw BSON types and sensitive fields privately; never print them.
    const backup = {};
    for (const { name } of await db.listCollections().toArray()) backup[name] = await db.collection(name).find({}).toArray();
    await fs.mkdir('backups.local', { recursive: true });
    const backupPath = `backups.local/before-demo-refresh-${Date.now()}.ejson`;
    await fs.writeFile(backupPath, mongoose.mongo.BSON.EJSON.stringify(backup), { flag: 'wx' });
    const password = `Demo-${randomBytes(9).toString('base64url')}!`;
    const today = todayStr();
    const access = { database: db.databaseName, password, customers: scenarios.map(({ name, phone, email }) => ({ name, phone, email })), backupPath };
    await fs.writeFile('demo-access.local', JSON.stringify(access, null, 2));
    for (const model of [User, Subscription, MealRecord, CreditLedger, CreditAdjustment, Activity]) await model.createIndexes();
    await mongoose.connection.transaction(async session => {
      const subIds = oldSubs.map(s => s._id), subCodes = oldSubs.map(s => s.subCode).filter(Boolean);
      // Fail if the removal set changed since the reviewed preview/backup.
      if (await User.countDocuments(selector).session(session) !== ids.length) throw new Error('Demo accounts changed; rerun preview.');
      for (const name of ['mealrecords', 'creditadjustments', 'creditledgers']) await db.collection(name).deleteMany({ $or: [{ user: { $in: ids } }, { subscription: { $in: subIds } }] }, { session });
      await db.collection('creditoperations').deleteMany({ 'result.subscription._id': { $in: subIds.map(String) } }, { session });
      await Activity.deleteMany({ $or: [{ userId: { $in: ids.map(String) } }, { subscriptionId: { $in: [...subCodes, ...subIds.map(String)] } }] }, { session });
      await Subscription.deleteMany({ _id: { $in: subIds } }, { session });
      await User.deleteMany({ _id: { $in: ids } }, { session });
      for (const [i, scenario] of scenarios.entries()) {
        const [user] = await User.create([{ name: scenario.name, phone: scenario.phone, email: scenario.email, password, notes: marker,
          address: scenario.noAddress ? null : { houseOrFlat: `Demo Flat ${i + 1}`, street: 'Sample Street', area: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' } }], { session });
        for (const [mealType, allocated, consumed] of scenario.plans) {
          const [sub] = await Subscription.create([{ user: user._id, subCode: `DEMO-${i + 1}-${mealType.toUpperCase()}`, accountingVersion: 2,
            mealTypes: [mealType], mealCredits: { [mealType]: { allocated, consumed, adjustments: 0 } }, allocatedMeals: allocated,
            durationMonths: 1, startDate: addDays(today, scenario.start ?? -4), endDate: addDays(today, scenario.end ?? 25) }], { session });
          const entry = (delta, operation, suffix, booking) => ({ user: user._id, subscription: sub._id, mealType, delta, operation, operationKey: `demo:${sub._id}:${suffix}`, booking, expiresOn: sub.endDate });
          await CreditLedger.create([entry(allocated, 'allocation', 'allocation')], { session });
          const historyEnd = scenario.end < 0 ? addDays(sub.endDate, -1) : addDays(today, -1);
          for (let n = 0; n < consumed; n++) {
            const date = addDays(historyEnd, -n);
            const [record] = await MealRecord.create([{ user: user._id, subscription: sub._id, mealType, date, status: 'Consumed', accountingVersion: 2, consumedAt: new Date(`${date}T07:00:00+05:30`) }], { session });
            await CreditLedger.create([entry(-1, 'consumption', `consumption:${n}`, record._id)], { session });
          }
          const cancelDate = i === 0 && mealType === 'dinner' ? addDays(today, 1) : null;
          if (cancelDate) {
            const [record] = await MealRecord.create([{ user: user._id, subscription: sub._id, mealType, date: cancelDate, status: 'Cancelled', accountingVersion: 2, cancelledBy: 'user', cancelledAt: new Date() }], { session });
            await CreditLedger.create([entry(0, 'cancellation_preserved', 'cancellation', record._id)], { session });
          }
          let scheduled = 0;
          for (let date = today; date <= sub.endDate && scheduled < allocated - consumed; date = addDays(date, 1)) {
            if (date === cancelDate) continue;
            await MealRecord.create([{ user: user._id, subscription: sub._id, mealType, date, status: 'Scheduled', accountingVersion: 2 }], { session });
            scheduled++;
          }
          await Activity.create([{ type: 'allocated', label: 'Demo subscription allocated', userId: String(user._id), userName: user.name, subscriptionId: sub.subCode, detail: `${mealType}: ${allocated} allocated, ${consumed} consumed, ${allocated - consumed} remaining` }], { session });
        }
      }
    });
    const newUsers = await User.find({ notes: marker });
    const newSubs = await Subscription.find({ user: { $in: newUsers.map(u => u._id) } });
    for (const sub of newSubs) {
      const ledger = await CreditLedger.find({ subscription: sub._id });
      if (ledger.reduce((sum, e) => sum + e.delta, 0) !== sub.remainingCredits) throw new Error('Ledger verification failed.');
      if (await MealRecord.countDocuments({ subscription: sub._id, status: 'Consumed' }) !== sub.consumedMeals) throw new Error('Consumption verification failed.');
    }
    console.log(JSON.stringify({ saved: true, backupPath, accessFile: 'demo-access.local', users: newUsers.length, subscriptions: newSubs.length,
      balances: newSubs.map(s => ({ subscription: s.subCode, remaining: s.remainingCredits })) }, null, 2));
  }
} finally { await mongoose.disconnect(); }
