import Subscription from '../models/Subscription.js';
import MealRecord from '../models/MealRecord.js';
import Activity from '../models/Activity.js';
import { deriveSubStatus, isLiveStatus } from './adminController.js';
import { cutoffFor } from '../../src/utils/userLogic.js';
import { todayStr, formatDate } from '../../src/utils/dates.js';
import { mealLabel } from '../../src/utils/adminLogic.js';

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

export async function getUserDashboard(req, res) {
  try {
    const userId = req.user._id;
    const today = todayStr();

    const [subs, records] = await Promise.all([
      Subscription.find({ user: userId }).sort({ createdAt: -1 }),
      MealRecord.find({ user: userId }),
    ]);

    const all = subs.map((s) => {
      const status = deriveSubStatus(s, today);
      const remaining = s.allocatedMeals - s.consumedMeals + s.approvedAdjustments;
      const entitlement = s.allocatedMeals + s.approvedAdjustments;
      return {
        sub: {
          id: s.subCode || s._id.toString(),
          _id: s._id.toString(),
          mealTypes: s.mealTypes,
          durationMonths: s.durationMonths,
          startDate: s.startDate,
          endDate: s.endDate,
          allocatedMeals: s.allocatedMeals,
          consumedMeals: s.consumedMeals,
          approvedAdjustments: s.approvedAdjustments,
          demoPrice: s.demoPrice,
        },
        status,
        credit: {
          allocated: s.allocatedMeals,
          consumed: s.consumedMeals,
          adjustments: s.approvedAdjustments,
          entitlement,
          remaining: Math.max(0, remaining),
        },
        percentUsed: entitlement > 0 ? Math.min(100, Math.round((s.consumedMeals / entitlement) * 100)) : 0,
      };
    });

    const running = all.filter((x) => isLiveStatus(x.status));
    const past = all.filter((x) => !isLiveStatus(x.status));

    // Independent Per-Meal-Type breakdown
    const mealCredits = { breakfast: null, lunch: null, dinner: null };
    for (const mealType of MEAL_KEYS) {
      const covering = running.filter((x) => x.sub.mealTypes.includes(mealType));
      if (!covering.length) continue;

      let allocated = 0, consumed = 0, adjustments = 0;
      for (const item of covering) {
        allocated += item.credit.allocated;
        consumed += item.credit.consumed;
        adjustments += item.credit.adjustments;
      }
      mealCredits[mealType] = {
        allocated,
        consumed,
        adjustments,
        entitlement: allocated + adjustments,
        remaining: Math.max(0, allocated - consumed + adjustments),
        subscriptions: covering.map((x) => x.sub.id),
      };
    }

    const expiries = running.map((x) => x.sub.endDate).sort();
    const expiring = running.filter((x) => x.status === 'Expiring soon');
    let overallStatus = 'No subscription';
    if (running.length) overallStatus = expiring.length ? 'Expiring soon' : 'Active';

    // Total running subscription IDs
    const runningSubIds = new Set(running.map((x) => x.sub._id));
    const runningRecords = records.filter((m) => runningSubIds.has(m.subscription.toString()));

    const stats = {
      remaining: running.reduce((sum, x) => sum + x.credit.remaining, 0),
      consumed: runningRecords.filter((m) => m.status === 'Consumed').length,
      cancelled: runningRecords.filter((m) => m.status === 'Cancelled' && m.cancelledBy !== 'subscription').length,
      activeSubscriptions: running.length,
      breakdownByMeal: mealCredits,
    };

    res.json({
      ok: true,
      summary: {
        running,
        past,
        overallStatus,
        expiring,
        nearestExpiry: expiries[0] ?? null,
        mealCredits,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function getTodaysMeals(req, res) {
  try {
    const userId = req.user._id;
    const today = todayStr();
    const now = new Date();

    const subs = await Subscription.find({
      user: userId,
      status: { $ne: 'Cancelled' },
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    const liveIds = new Set(subs.map((s) => s._id.toString()));
    const records = await MealRecord.find({
      user: userId,
      date: today,
      subscription: { $in: Array.from(liveIds) },
    });

    const result = MEAL_KEYS.map((mealType) => {
      const included = subs.some((s) => s.mealTypes.includes(mealType));
      const cutoff = cutoffFor(today, mealType);
      const entries = records
        .filter((m) => m.mealType === mealType)
        .map((m) => ({
          id: m.recordCode || m._id.toString(),
          _id: m._id.toString(),
          subscriptionId: m.subscription.toString(),
          status: m.status,
          cancelledAt: m.cancelledAt ? m.cancelledAt.toISOString() : null,
          cancellable: m.status === 'Scheduled' && now <= cutoff,
        }));

      return {
        mealType,
        included,
        cutoff,
        entries,
        status: entries.length ? null : included ? 'Not scheduled' : 'Not Included',
      };
    });

    res.json({ ok: true, today, meals: result });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function getRecentMealActivity(req, res) {
  try {
    const userId = req.user._id;
    const today = todayStr();
    const limit = Number(req.query.limit) || 8;

    const meals = await MealRecord.find({ user: userId, date: { $lte: today } })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);

    res.json({
      ok: true,
      meals: meals.map((m) => ({
        id: m.recordCode || m._id.toString(),
        _id: m._id.toString(),
        userId: m.user.toString(),
        subscriptionId: m.subscription.toString(),
        mealType: m.mealType,
        date: m.date,
        status: m.status,
        cancelledAt: m.cancelledAt,
        cancelledBy: m.cancelledBy,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export async function cancelUserMeal(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const today = todayStr();
    const now = new Date();

    const record = await MealRecord.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { recordCode: id }],
    });

    if (!record || record.user.toString() !== userId.toString()) {
      return res.status(404).json({ ok: false, message: 'Meal record not found.' });
    }

    if (record.status === 'Cancelled') {
      return res.status(400).json({ ok: false, message: 'This meal is already cancelled.' });
    }

    if (record.status !== 'Scheduled') {
      return res.status(400).json({ ok: false, message: `A ${record.status.toLowerCase()} meal cannot be cancelled.` });
    }

    const sub = await Subscription.findById(record.subscription);
    if (!sub || sub.status === 'Cancelled' || sub.endDate < today) {
      return res.status(400).json({ ok: false, message: 'This meal belongs to a subscription that is no longer active.' });
    }

    const cutoff = cutoffFor(record.date, record.mealType);
    if (now > cutoff) {
      const deadlineStr = cutoff.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
      return res.status(400).json({
        ok: false,
        message: `The cancellation deadline for this meal passed on ${deadlineStr}.`,
      });
    }

    record.status = 'Cancelled';
    record.cancelledAt = now;
    record.cancelledBy = 'user';
    await record.save();

    await Activity.create({
      type: 'meal_cancelled',
      label: 'Meal cancelled',
      userId: userId.toString(),
      userName: req.user.name,
      subscriptionId: sub.subCode || sub._id.toString(),
      detail: `${mealLabel(record.mealType)} on ${formatDate(record.date)} (${sub.subCode || sub._id}), cancelled by the customer`,
    });

    res.json({
      ok: true,
      record: {
        id: record.recordCode || record._id.toString(),
        status: record.status,
        cancelledAt: record.cancelledAt,
      },
      message: 'Meal cancelled successfully. Credit preserved.',
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}
