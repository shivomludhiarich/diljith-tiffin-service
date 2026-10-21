// Demo data for the admin portal. Dates are generated relative to "today" so the dashboard always has
// something to show. It is only used when localStorage has no (valid) admin data.
import { MOCK_USERS } from './mockUsers.js';
import { addDays, endDateFor, todayStr } from '../utils/dates.js';
import { MEAL_STATUS, scheduleMeals } from '../utils/adminLogic.js';

const ORDER = ['breakfast', 'lunch', 'dinner'];

const PLANS = [
  { id: 'SUB-0998', u: 'u6', months: 1, meals: ['lunch'], offset: -100, alloc: 30, missEvery: 16 },
  { id: 'SUB-1001', u: 'u1', months: 3, meals: ['lunch'], offset: -40, alloc: 90, cancelEvery: 9, todayCancel: ['lunch'] },
  { id: 'SUB-1002', u: 'u2', months: 1, meals: ['lunch', 'dinner'], offset: -11, alloc: 60 },
  { id: 'SUB-1003', u: 'u3', months: 1, meals: ['breakfast', 'lunch', 'dinner'], offset: -24, alloc: 90, cancelEvery: 11, missEvery: 17 },
  { id: 'SUB-1004', u: 'u4', months: 3, meals: ['breakfast'], offset: -110, alloc: 90, cancelEvery: 10 },
  { id: 'SUB-1005', u: 'u5', months: 1, meals: ['dinner'], offset: -12, alloc: 30, cancelled: true },
  { id: 'SUB-1006', u: 'u6', months: 6, meals: ['breakfast', 'lunch'], offset: -60, alloc: 360, cancelEvery: 12, todayCancel: ['breakfast'] },
  { id: 'SUB-1007', u: 'u8', months: 1, meals: ['lunch'], offset: -27, alloc: 30, missEvery: 14 },
];

export function createSeed(today = todayStr(), now = new Date()) {
  const users = MOCK_USERS.map((u) => ({ ...u }));
  const ago = (hours) => new Date(now.getTime() - hours * 3600000).toISOString();
  const nameOf = (id) => users.find((u) => u.id === id).name;

  const adjustments = [
    { id: 'adj-seed-1', userId: 'u3', subscriptionId: 'SUB-1003', amount: 10, reason: 'Goodwill: delayed deliveries last week', kind: 'adjustment', createdAt: ago(48) },
    { id: 'adj-seed-2', userId: 'u6', subscriptionId: 'SUB-1006', amount: 20, reason: 'Promotional top-up', kind: 'adjustment', createdAt: ago(216) },
  ];

  const subscriptions = [];
  const mealRecords = [];
  let n = 0;
  for (const p of PLANS) {
    const start = addDays(today, p.offset);
    const sub = {
      id: p.id, userId: p.u, durationMonths: p.months, mealTypes: p.meals, startDate: start,
      endDate: endDateFor(start, p.months), allocatedMeals: p.alloc, status: p.cancelled ? 'Cancelled' : 'Active',
      createdAt: `${start}T09:00:00.000Z`, renewals: [],
    };
    if (p.cancelled) Object.assign(sub, { cancelledAt: ago(20), cancelReason: 'Cancelled by admin' });
    subscriptions.push(sub);

    // Past meals: mostly consumed, with the odd cancelled or missed one.
    const lastPast = sub.endDate < today ? sub.endDate : addDays(today, -1);
    let i = 0;
    let consumed = 0;
    for (let d = start; d <= lastPast; d = addDays(d, 1)) {
      for (const mealType of ORDER.filter((m) => p.meals.includes(m))) {
        i += 1;
        let status = MEAL_STATUS.CONSUMED;
        if (p.cancelEvery && i % p.cancelEvery === 0) status = MEAL_STATUS.CANCELLED;
        else if (p.missEvery && i % p.missEvery === 0) status = MEAL_STATUS.MISSED;
        if (status === MEAL_STATUS.CONSUMED) consumed += 1;
        const rec = { id: `meal-seed-${++n}`, userId: p.u, subscriptionId: p.id, date: d, mealType, status };
        if (status === MEAL_STATUS.CANCELLED) Object.assign(rec, { cancelledAt: `${addDays(d, -1)}T09:30:00.000Z`, cancelledBy: 'user' });
        mealRecords.push(rec);
      }
    }
    // Today and future meals for live subscriptions, never exceeding the remaining credits.
    if (!p.cancelled && sub.endDate >= today) {
      const adj = adjustments.filter((a) => a.subscriptionId === p.id).reduce((s, a) => s + a.amount, 0);
      const future = scheduleMeals(sub, today, p.alloc + adj - consumed).map((m) =>
        m.date === today && (p.todayCancel || []).includes(m.mealType)
          ? { ...m, status: MEAL_STATUS.CANCELLED, cancelledAt: ago(2), cancelledBy: 'user' } : m);
      mealRecords.push(...future);
    }
  }

  const act = (hours, type, label, userId, detail, subscriptionId) =>
    ({ id: `act-seed-${hours}-${type}`, type, label, userId, userName: nameOf(userId), subscriptionId, detail, createdAt: ago(hours) });
  const activity = [
    act(2, 'meal_cancelled', 'Meal cancelled', 'u1', 'Lunch today (SUB-1001)', 'SUB-1001'),
    act(5, 'meal_cancelled', 'Meal cancelled', 'u6', 'Breakfast today (SUB-1006)', 'SUB-1006'),
    act(20, 'cancelled', 'Subscription cancelled', 'u5', 'SUB-1005 cancelled. History kept.', 'SUB-1005'),
    act(48, 'credits', 'Meal credits increased', 'u3', '+10 meals on SUB-1003 · Goodwill: delayed deliveries last week', 'SUB-1003'),
    act(216, 'credits', 'Meal credits increased', 'u6', '+20 meals on SUB-1006 · Promotional top-up', 'SUB-1006'),
    act(264, 'allocated', 'Subscription allocated', 'u2', 'SUB-1002 · 1 month · Lunch, Dinner · 60 meals', 'SUB-1002'),
    act(960, 'allocated', 'Subscription allocated', 'u1', 'SUB-1001 · 3 months · Lunch · 90 meals', 'SUB-1001'),
  ];

  return { users, subscriptions, mealRecords, adjustments, activity };
}
