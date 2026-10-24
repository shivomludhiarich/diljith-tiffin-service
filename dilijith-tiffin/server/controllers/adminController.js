import { balances, totals } from '../services/credits.js';
import CreditLedger from '../models/CreditLedger.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import MealRecord from '../models/MealRecord.js';
import CreditAdjustment from '../models/CreditAdjustment.js';
import Activity from '../models/Activity.js';
import { addDays, todayStr } from '../../src/utils/dates.js';
import { validatePhone } from '../utils/phone.js';

/** Escape user input before using it in a RegExp to prevent ReDoS. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

/** Helper to derive subscription status relative to today */
export function deriveSubStatus(sub, today) {
  if (sub.status === 'Cancelled') return 'Cancelled';
  if (sub.endDate < today) return 'Expired';
  const expiringCutoff = addDays(today, 7);
  if (sub.endDate <= expiringCutoff) return 'Expiring soon';
  return 'Active';
}

export function isLiveStatus(status) {
  return status === 'Active' || status === 'Expiring soon';
}

/** Formatter helper */
export function formatSub(s, today) {
  const currentStatus = deriveSubStatus(s, today);
  const remaining = totals(s)?.remaining;
  return {
    id: s.subCode || s._id.toString(),
    _id: s._id.toString(),
    userId: s.user ? (s.user._id ? s.user._id.toString() : s.user.toString()) : '',
    user: s.user,
    mealTypes: s.mealTypes,
    durationMonths: s.durationMonths,
    startDate: s.startDate,
    endDate: s.endDate,
    allocatedMeals: s.allocatedMeals,
    consumedMeals: s.consumedMeals,
    approvedAdjustments: s.approvedAdjustments,
    remainingCredits: remaining ?? null,
    credit: totals(s),
    accountingVersion: s.accountingVersion,
    requiresCreditReview: !balances(s),
    balances: balances(s),
    status: currentStatus,
    dbStatus: s.status,
    demoPrice: s.demoPrice,
    renewals: (s.renewals || []).map((r, i) => ({ ...r.toObject?.() ?? r, id: `${s._id}-${i}`, previousEndDate: addDays(r.fromDate, -1), newEndDate: r.toDate, creditsAdded: r.addedMeals })),
    cancelledAt: s.cancelledAt,
    cancelReason: s.cancelReason,
    createdAt: s.createdAt,
    mealCredits: s.mealCredits || null,
  };
}

export async function getAdminState(req, res) {
  try {
    const today = todayStr();
    const [rawUsers, rawSubs, rawMeals, rawAdjustments, rawActivity, rawLedger] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Subscription.find().populate('user', 'name email role').sort({ createdAt: -1 }),
      MealRecord.find().sort({ date: -1 }),
      CreditAdjustment.find().sort({ createdAt: -1 }),
      Activity.find().sort({ createdAt: -1 }).limit(100),
      CreditLedger.find().sort({ createdAt: -1 }).lean(),
    ]);

    const users = rawUsers.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      address: u.address ?? null,
      hasAddress: !!(u.address && u.address.city),
      registeredOn: u.createdAt.toISOString().slice(0, 10),
    }));

    const subscriptions = rawSubs.map((s) => formatSub(s, today));

    const subCodeMap = new Map();
    for (const s of rawSubs) {
      subCodeMap.set(s._id.toString(), s.subCode || s._id.toString());
    }

    const mealRecords = rawMeals.map((m) => {
      const subIdStr = m.subscription ? m.subscription.toString() : '';
      return {
        id: m.recordCode || m._id.toString(),
        _id: m._id.toString(),
        userId: m.user.toString(),
        subscriptionId: subCodeMap.get(subIdStr) || subIdStr,
        mealType: m.mealType,
        date: m.date,
        status: m.status,
        cancelledAt: m.cancelledAt ? m.cancelledAt.toISOString() : null,
        cancelledBy: m.cancelledBy,
      };
    });

    const adjustments = rawAdjustments.map((a) => {
      const subIdStr = a.subscription ? a.subscription.toString() : '';
      return {
        id: a._id.toString(),
        _id: a._id.toString(),
        userId: a.user.toString(),
        subscriptionId: subCodeMap.get(subIdStr) || subIdStr,
        amount: a.amount,
        reason: a.reason,
        mealType: a.mealType || null,
        createdAt: a.createdAt.toISOString(),
      };
    });

    const activity = rawActivity.map((a) => ({
      id: a._id.toString(),
      _id: a._id.toString(),
      type: a.type,
      label: a.label,
      userId: a.userId,
      userName: a.userName,
      subscriptionId: a.subscriptionId,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    }));

    res.json({
      ok: true,
      today,
      state: {
        ledger: rawLedger,
        users,
        subscriptions,
        mealRecords,
        adjustments,
        activity,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function getUsers(req, res) {
  try {
    const { search } = req.query;
    let query = {};
    if (search && String(search).trim()) {
      const safe = escapeRegex(String(search).trim());
      query = {
        $or: [
          { name: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
          { phone: { $regex: safe, $options: 'i' } },
        ],
      };
    }
    const rawUsers = await User.find(query).sort({ createdAt: -1 });
    const users = rawUsers.map((u) => ({
      _id: u._id.toString(),
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      address: u.address ?? null,
      hasAddress: !!(u.address && u.address.city),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
    res.json({ ok: true, users });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const { name, email, password, phone, countryCode = '+91' } = req.body;
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ ok: false, field: 'password', message: 'Provide a password of at least 6 characters and at most 72 bytes.' });
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, field: 'name', message: 'Name is required.' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ ok: false, field: 'email', message: 'Email is required.' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ ok: false, field: 'phone', message: 'Phone number is required.' });
    }
    const phoneCheck = validatePhone(phone, countryCode);
    if (!phoneCheck.valid) {
      return res.status(400).json({ ok: false, field: 'phone', message: phoneCheck.message });
    }
    const normalizedPhone = phoneCheck.normalized;

    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone: normalizedPhone }),
    ]);
    if (existingEmail) {
      return res.status(409).json({ ok: false, field: 'email', message: 'Email already registered.' });
    }
    if (existingPhone) {
      return res.status(409).json({ ok: false, field: 'phone', message: 'Phone number already registered.' });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: normalizedPhone,
      role: 'user',
      status: 'Active',
    });
    res.status(201).json({ ok: true, user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status } });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({ ok: false, field, message: `A user with this ${field} already exists.` });
    }
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function getDashboardMetrics(req, res) {
  try {
    const today = todayStr();
    const [totalUsers, allSubs, mealsTodayScheduled, mealsTodayCancelled, recentActivities] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Subscription.find(),
      MealRecord.countDocuments({ date: today, status: 'Scheduled' }),
      MealRecord.countDocuments({ date: today, status: 'Cancelled' }),
      Activity.find().sort({ createdAt: -1 }).limit(8),
    ]);

    let activeCount = 0;
    let expiringSoonCount = 0;
    for (const s of allSubs) {
      const st = deriveSubStatus(s, today);
      if (st === 'Active' || st === 'Expiring soon') activeCount++;
      if (st === 'Expiring soon') expiringSoonCount++;
    }

    // Prep counts by meal type for today
    const prep = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const mealType of MEAL_KEYS) {
      prep[mealType] = await MealRecord.countDocuments({
        date: today,
        mealType,
        status: 'Scheduled',
      });
    }

    // Count users with missing address
    const usersWithoutAddress = await User.countDocuments({
      role: { $ne: 'admin' },
      $or: [{ address: null }, { address: { $exists: false } }],
    });

    res.json({
      ok: true,
      metrics: {
        totalUsers,
        activeSubscriptions: activeCount,
        mealsToday: mealsTodayScheduled,
        mealsCancelledToday: mealsTodayCancelled,
        expiringSoon: expiringSoonCount,
        usersWithoutAddress,
        prep,
      },
      activity: recentActivities,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

/**
 * GET /api/admin/meals/summary?date=YYYY-MM-DD
 * Returns scheduled meal counts per meal type for a given date.
 */
export async function getMealSummary(req, res) {
  try {
    const { date } = req.query;
    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr();

    const counts = await Promise.all(
      MEAL_KEYS.map(async (mealType) => {
        const count = await MealRecord.countDocuments({ date: targetDate, mealType, status: 'Scheduled' });
        return [mealType, count];
      })
    );

    const prep = Object.fromEntries(counts);
    const total = counts.reduce((sum, [, c]) => sum + c, 0);

    res.json({ ok: true, date: targetDate, prep, total });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

/**
 * GET /api/admin/meals/deliveries?date=YYYY-MM-DD&mealType=lunch
 * Returns the delivery list for a specific meal type and date.
 * Each record includes user name, phone, and delivery address.
 */
export async function getMealDeliveries(req, res) {
  try {
    const { date, mealType } = req.query;
    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr();

    if (!MEAL_KEYS.includes(mealType)) {
      return res.status(400).json({ ok: false, message: 'mealType must be breakfast, lunch, or dinner.' });
    }

    // Fetch scheduled meals for this date + mealType, populate only needed user fields
    const records = await MealRecord.find({ date: targetDate, mealType, status: 'Scheduled' })
      .populate('user', 'name phone address status')
      .sort({ createdAt: 1 });

    // Group by user so we can count portions per user
    const byUser = new Map();
    for (const rec of records) {
      const u = rec.user;
      if (!u) continue; // orphaned record
      const uid = u._id.toString();
      if (!byUser.has(uid)) {
        const hasAddress = !!(u.address && u.address.city);
        byUser.set(uid, {
          userId:       uid,
          name:         u.name,
          phone:        u.phone,
          address:      u.address ?? null,
          hasAddress,
          portions:     0,
          mealType,
          date:         targetDate,
          recordIds:    [],
        });
      }
      const entry = byUser.get(uid);
      entry.portions += 1;
      entry.recordIds.push(rec._id.toString());
    }

    const deliveries = [...byUser.values()];
    const totalPortions = deliveries.reduce((s, d) => s + d.portions, 0);
    const missingAddress = deliveries.filter((d) => !d.hasAddress).length;

    res.json({
      ok: true,
      date:            targetDate,
      mealType,
      customerCount:   deliveries.length,
      totalPortions,
      missingAddress,
      deliveries,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}
