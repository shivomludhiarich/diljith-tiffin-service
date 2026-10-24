import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import MealRecord from '../models/MealRecord.js';
import CreditAdjustment from '../models/CreditAdjustment.js';
import Activity from '../models/Activity.js';
import { MOCK_USERS } from '../../src/data/mockUsers.js';
import { createSeed } from '../../src/data/adminSeed.js';
import { normalizePhone } from '../utils/phone.js';

export async function seedInitialDataIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    // Database already has records, preserve existing data completely
    return;
  }

  console.log('[Seed] Database is empty. Seeding initial accounts and subscriptions...');

  // 1. Create Admin
  const admin = await User.create({
    name: 'Dilijith Admin',
    email: 'admin@dilijithtiffin.com',
    password: 'Admin@123',
    role: 'admin',
    phone: normalizePhone('+919999999999'),
    status: 'Active',
  });

  // 2. Create Customers
  const userMap = {}; // 'u1' -> userDoc
  for (const u of MOCK_USERS) {
    const rawPhone = u.phone || '9000000000';
    const created = await User.create({
      name: u.name,
      email: u.email,
      password: 'User@123',
      role: 'user',
      phone: normalizePhone(rawPhone),
      status: 'Active',
    });
    userMap[u.id] = created;
  }

  // 3. Create Seed Subscriptions & Records
  const seed = createSeed();
  const subMap = {}; // 'SUB-1001' -> subDoc

  for (const s of seed.subscriptions) {
    const user = userMap[s.userId] || admin;
    const baseAlloc = Math.floor(s.allocatedMeals / s.mealTypes.length);
    const remAlloc = s.allocatedMeals % s.mealTypes.length;
    const subMealCredits = { breakfast: null, lunch: null, dinner: null };
    s.mealTypes.forEach((m, idx) => {
      subMealCredits[m] = {
        allocated: baseAlloc + (idx < remAlloc ? 1 : 0),
        consumed: 0,
        adjustments: 0,
      };
    });

    const sub = await Subscription.create({
      subCode: s.id,
      user: user._id,
      mealTypes: s.mealTypes,
      durationMonths: s.durationMonths,
      startDate: s.startDate,
      endDate: s.endDate,
      allocatedMeals: s.allocatedMeals,
      consumedMeals: 0,
      approvedAdjustments: 0,
      mealCredits: subMealCredits,
      status: s.status,
      demoPrice: s.demoPrice ?? null,
      cancelledAt: s.cancelledAt ? new Date(s.cancelledAt) : null,
      cancelReason: s.cancelReason || '',
      renewals: s.renewals || [],
    });
    subMap[s.id] = sub;
  }

  // 4. Create Adjustments
  for (const a of seed.adjustments) {
    const sub = subMap[a.subscriptionId];
    if (sub) {
      await CreditAdjustment.create({
        subscription: sub._id,
        user: sub.user,
        amount: a.amount,
        reason: a.reason,
        mealType: a.mealType || null,
      });
      sub.approvedAdjustments += a.amount;
      if (sub.mealCredits) {
        const targetTypes = a.mealType && sub.mealTypes.includes(a.mealType) ? [a.mealType] : sub.mealTypes;
        const adjBase = Math.floor(a.amount / targetTypes.length);
        const adjRem = a.amount % targetTypes.length;
        targetTypes.forEach((m, idx) => {
          if (sub.mealCredits[m]) {
            sub.mealCredits[m].adjustments += adjBase + (idx < Math.abs(adjRem) ? (adjRem > 0 ? 1 : -1) : 0);
          }
        });
      }
      await sub.save();
    }
  }

  // 5. Create Meal Records
  const mealDocs = [];
  for (const m of seed.mealRecords) {
    const sub = subMap[m.subscriptionId];
    const user = userMap[m.userId] || admin;
    if (sub && user) {
      mealDocs.push({
        recordCode: m.id,
        user: user._id,
        subscription: sub._id,
        mealType: m.mealType,
        date: m.date,
        status: m.status,
        cancelledAt: m.cancelledAt ? new Date(m.cancelledAt) : null,
        cancelledBy: m.cancelledBy || null,
      });
      if (m.status === 'Consumed') {
        sub.consumedMeals += 1;
        if (sub.mealCredits && sub.mealCredits[m.mealType]) {
          sub.mealCredits[m.mealType].consumed += 1;
        }
      }
    }
  }
  if (mealDocs.length) {
    await MealRecord.insertMany(mealDocs);
  }

  // Save updated consumedMeals and mealCredits counts on subscriptions
  for (const sub of Object.values(subMap)) {
    await sub.save();
  }

  // 6. Create Initial Activity Log
  for (const act of seed.activity) {
    await Activity.create({
      type: act.type,
      label: act.label,
      userId: act.userId,
      userName: act.userName,
      subscriptionId: act.subscriptionId,
      detail: act.detail,
    });
  }

  console.log('[Seed] Initial MongoDB seeding completed successfully.');
}
