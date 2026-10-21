import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import MealRecord from '../models/MealRecord.js';
import CreditAdjustment from '../models/CreditAdjustment.js';
import Activity from '../models/Activity.js';
import { addDays, endDateFor, todayStr, isValidDateStr } from '../../src/utils/dates.js';
import { normalizePhone, validatePhone } from '../utils/phone.js';

/** Escape user input before using it in a RegExp to prevent ReDoS. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a collision-safe subscription code by querying the highest existing
 * SUB-XXXX code and incrementing it. Using countDocuments() is unsafe because
 * deleted documents lower the count and concurrent inserts can produce the same value.
 */
async function nextSubCode() {
  const last = await Subscription.findOne({ subCode: /^SUB-\d+$/ })
    .sort({ subCode: -1 })
    .select('subCode')
    .lean();
  if (!last) return 'SUB-1001';
  const num = parseInt(last.subCode.replace('SUB-', ''), 10) || 1000;
  return `SUB-${num + 1}`;
}

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
const DURATIONS = [1, 3, 6, 12];

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
function formatSub(s, today) {
  const currentStatus = deriveSubStatus(s, today);
  const remaining = s.allocatedMeals - s.consumedMeals + s.approvedAdjustments;
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
    remainingCredits: Math.max(0, remaining),
    status: currentStatus,
    dbStatus: s.status,
    demoPrice: s.demoPrice,
    renewals: s.renewals || [],
    createdAt: s.createdAt,
  };
}

export async function getAdminState(req, res) {
  try {
    const today = todayStr();
    const [rawUsers, rawSubs, rawMeals, rawAdjustments, rawActivity] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Subscription.find().populate('user', 'name email role').sort({ createdAt: -1 }),
      MealRecord.find().sort({ date: -1 }),
      CreditAdjustment.find().sort({ createdAt: -1 }),
      Activity.find().sort({ createdAt: -1 }).limit(100),
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

    const mealRecords = rawMeals.map((m) => ({
      id: m.recordCode || m._id.toString(),
      _id: m._id.toString(),
      userId: m.user.toString(),
      subscriptionId: m.subscription.toString(),
      mealType: m.mealType,
      date: m.date,
      status: m.status,
      cancelledAt: m.cancelledAt ? m.cancelledAt.toISOString() : null,
      cancelledBy: m.cancelledBy,
    }));

    const adjustments = rawAdjustments.map((a) => ({
      id: a._id.toString(),
      _id: a._id.toString(),
      userId: a.user.toString(),
      subscriptionId: a.subscription.toString(),
      amount: a.amount,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    }));

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
    const { name, email, password = 'User@123', phone, role = 'user', countryCode = '+91' } = req.body;
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
      role,
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

export async function allocateSubscription(req, res) {
  try {
    const { userId, durationMonths, mealTypes, startDate, allocatedMeals, confirmReplace, demoPrice } = req.body;
    const today = todayStr();
    const nowIso = new Date().toISOString();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, errors: { userId: 'User not found.' } });

    const months = Number(durationMonths);
    const meals = MEAL_KEYS.filter((m) => (mealTypes || []).includes(m));
    const allocated = Number(allocatedMeals);

    const errors = {};
    if (!DURATIONS.includes(months)) errors.durationMonths = 'Choose a duration.';
    if (!meals.length) errors.mealTypes = 'Select at least one meal type.';
    if (!isValidDateStr(startDate)) errors.startDate = 'Choose a valid start date.';
    if (!Number.isInteger(allocated) || allocated < 1 || allocated > 5000) {
      errors.allocatedMeals = 'Enter a whole number of meals from 1 to 5000.';
    }
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    // Look for ACTIVE subscriptions covering the requested meal types for this user
    const existingSubs = await Subscription.find({
      user: user._id,
      status: { $ne: 'Cancelled' },
      endDate: { $gte: today },
    });

    const conflicts = [];
    for (const sub of existingSubs) {
      const overlap = meals.filter((m) => sub.mealTypes.includes(m));
      if (overlap.length) {
        conflicts.push({
          sub: formatSub(sub, today),
          subId: sub._id.toString(),
          overlappingMeals: overlap,
        });
      }
    }

    if (conflicts.length && !confirmReplace) {
      return res.json({
        ok: false,
        needsConfirm: true,
        conflicts,
        existing: conflicts[0].sub,
        errors: {},
      });
    }

    // Cancel conflicting subscriptions if confirmed
    const replaced = [];
    if (conflicts.length && confirmReplace) {
      for (const { subId } of conflicts) {
        const conflictSub = await Subscription.findById(subId);
        if (conflictSub) {
          conflictSub.status = 'Cancelled';
          conflictSub.cancelledAt = new Date();
          conflictSub.cancelReason = 'Replaced by new allocation';
          await conflictSub.save();

          // Cancel future scheduled meals
          await MealRecord.updateMany(
            { subscription: conflictSub._id, status: 'Scheduled', date: { $gte: today } },
            { $set: { status: 'Cancelled', cancelledAt: new Date(), cancelledBy: 'subscription' } }
          );
          replaced.push(conflictSub.subCode || conflictSub._id.toString());
        }
      }
    }

    // Generate collision-safe subscription code
    const subCode = await nextSubCode();
    const endDate = endDateFor(startDate, months);

    const newSub = await Subscription.create({
      subCode,
      user: user._id,
      mealTypes: meals,
      durationMonths: months,
      startDate,
      endDate,
      allocatedMeals: allocated,
      consumedMeals: 0,
      approvedAdjustments: 0,
      status: 'Active',
      demoPrice: demoPrice ?? null,
    });

    // Schedule meals for this subscription up to allocatedMeals
    const scheduledRecords = [];
    let count = 0;
    const start = startDate < today ? today : startDate;
    for (let d = start; d <= endDate && count < allocated; d = addDays(d, 1)) {
      for (const mealType of meals) {
        if (count >= allocated) break;
        scheduledRecords.push({
          recordCode: `meal-${Date.now()}-${++count}`,
          user: user._id,
          subscription: newSub._id,
          mealType,
          date: d,
          status: 'Scheduled',
        });
      }
    }

    if (scheduledRecords.length) {
      await MealRecord.insertMany(scheduledRecords);
    }

    const replacedLabel = replaced.length ? ` (replaced ${replaced.join(', ')})` : '';
    await Activity.create({
      type: 'allocated',
      label: 'Subscription allocated',
      userId: user._id.toString(),
      userName: user.name,
      subscriptionId: subCode,
      detail: `${months} month(s), ${meals.join('+')}, ${allocated} meals from ${startDate} to ${endDate}${replacedLabel}`,
    });

    res.status(201).json({
      ok: true,
      subscription: formatSub(newSub, today),
      message: 'Subscription allocated successfully.',
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function adjustCredits(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const num = Number(amount);
    if (!Number.isInteger(num) || num === 0) {
      return res.status(400).json({ ok: false, errors: { amount: 'Enter a non-zero whole number of meals.' } });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ ok: false, errors: { reason: 'Please give a reason for this change.' } });
    }
    const trimmedReason = reason.trim();

    // Find subscription first to validate remaining balance
    const sub = await Subscription.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { subCode: id }],
    }).populate('user', 'name');

    if (!sub) return res.status(404).json({ ok: false, message: 'Subscription not found.' });

    const currentRemaining = sub.allocatedMeals - sub.consumedMeals + sub.approvedAdjustments;
    if (currentRemaining + num < 0) {
      return res.status(400).json({
        ok: false,
        errors: { amount: `Cannot reduce by ${Math.abs(num)}. Only ${currentRemaining} credits remain.` },
      });
    }

    // Atomic increment — safe under concurrent requests
    const updated = await Subscription.findByIdAndUpdate(
      sub._id,
      { $inc: { approvedAdjustments: num } },
      { new: true }
    ).populate('user', 'name');

    await CreditAdjustment.create({
      subscription: updated._id,
      user: updated.user._id,
      amount: num,
      reason: trimmedReason,
    });

    await Activity.create({
      type: 'adjusted',
      label: 'Credits adjusted',
      userId: updated.user._id.toString(),
      userName: updated.user.name,
      subscriptionId: updated.subCode || updated._id.toString(),
      detail: `${num > 0 ? '+' : ''}${num} meals (${updated.subCode || updated._id}). Reason: ${trimmedReason}`,
    });

    const today = todayStr();
    res.json({
      ok: true,
      subscription: formatSub(updated, today),
      message: 'Credit adjustment saved successfully.',
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function renewSubscription(req, res) {
  try {
    const { id } = req.params;
    const today = todayStr();
    const sub = await Subscription.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { subCode: id }],
    }).populate('user', 'name');

    if (!sub) return res.status(404).json({ ok: false, message: 'Subscription not found.' });

    const fromDate = sub.endDate < today ? today : addDays(sub.endDate, 1);
    const newEnd = endDateFor(fromDate, sub.durationMonths);
    const addedMeals = sub.durationMonths * 30 * sub.mealTypes.length;

    sub.endDate = newEnd;
    sub.status = 'Active';
    sub.approvedAdjustments += addedMeals;
    sub.renewals.push({
      renewedAt: new Date(),
      durationMonths: sub.durationMonths,
      addedMeals,
      fromDate,
      toDate: newEnd,
    });
    await sub.save();

    // Schedule additional meals
    const scheduledRecords = [];
    let count = 0;
    for (let d = fromDate; d <= newEnd && count < addedMeals; d = addDays(d, 1)) {
      for (const mealType of sub.mealTypes) {
        if (count >= addedMeals) break;
        scheduledRecords.push({
          recordCode: `meal-${Date.now()}-${++count}`,
          user: sub.user._id,
          subscription: sub._id,
          mealType,
          date: d,
          status: 'Scheduled',
        });
      }
    }
    if (scheduledRecords.length) {
      await MealRecord.insertMany(scheduledRecords);
    }

    await Activity.create({
      type: 'renewed',
      label: 'Subscription renewed',
      userId: sub.user._id.toString(),
      userName: sub.user.name,
      subscriptionId: sub.subCode || sub._id.toString(),
      detail: `Extended by ${sub.durationMonths}m to ${newEnd}; +${addedMeals} meals`,
    });

    res.json({
      ok: true,
      subscription: formatSub(sub, today),
      message: 'Subscription renewed successfully.',
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function cancelSubscription(req, res) {
  try {
    const { id } = req.params;
    const today = todayStr();
    const sub = await Subscription.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { subCode: id }],
    }).populate('user', 'name');

    if (!sub) return res.status(404).json({ ok: false, message: 'Subscription not found.' });

    sub.status = 'Cancelled';
    sub.cancelledAt = new Date();
    sub.cancelReason = 'Cancelled by administrator';
    await sub.save();

    // Cancel all future scheduled meals
    await MealRecord.updateMany(
      { subscription: sub._id, status: 'Scheduled', date: { $gte: today } },
      { $set: { status: 'Cancelled', cancelledAt: new Date(), cancelledBy: 'subscription' } }
    );

    await Activity.create({
      type: 'cancelled',
      label: 'Subscription cancelled',
      userId: sub.user._id.toString(),
      userName: sub.user.name,
      subscriptionId: sub.subCode || sub._id.toString(),
      detail: `Plan ${sub.subCode || sub._id} cancelled by admin; future meals removed`,
    });

    res.json({
      ok: true,
      subscription: formatSub(sub, today),
      message: 'Subscription cancelled successfully.',
    });
  } catch (error) {
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
