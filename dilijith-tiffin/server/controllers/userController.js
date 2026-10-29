import { isServiceDay, mealHistoryStatus, needsSundayCreditReview } from '../../src/utils/serviceDays.js';
import { balances, totals } from '../services/credits.js';
export { cancelUserMeal } from './creditController.js';
import Subscription from '../models/Subscription.js';
import MealRecord from '../models/MealRecord.js';
import { deriveSubStatus, isLiveStatus } from './adminController.js';
import { cutoffFor } from '../../src/utils/userLogic.js';
import { todayStr, addDays } from '../../src/utils/dates.js';

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
      const credit = totals(s);
      const entitlement = credit?.entitlement ?? 0;
      return {
        sub: {
          id: s.subCode || s._id.toString(),
          _id: s._id.toString(),
          mealTypes: s.mealTypes,
          durationMonths: s.durationMonths,
          startDate: s.startDate,
          endDate: null,
          allocatedMeals: s.allocatedMeals,
          consumedMeals: s.consumedMeals,
          approvedAdjustments: s.approvedAdjustments,
          demoPrice: s.demoPrice,
          mealCredits: balances(s),
          requiresCreditReview: !credit,
        },
        status,
        credit: credit ?? { allocated: null, consumed: null, adjustments: null, entitlement: null, remaining: null },
        percentUsed: entitlement > 0 ? Math.min(100, Math.round((credit.consumed / entitlement) * 100)) : 0,
      };
    });

    const running = all.filter((x) => isLiveStatus(x.status));
    const past = all.filter((x) => !isLiveStatus(x.status));

    // Total running subscription IDs
    const runningSubIds = new Set(running.map((x) => x.sub._id));
    const runningRecords = records.filter((m) => runningSubIds.has(m.subscription.toString()));

    // Independent Per-Meal-Type breakdown
    const mealCredits = { breakfast: null, lunch: null, dinner: null };
    for (const mealType of MEAL_KEYS) {
      let covering = running.filter((x) => x.sub.mealTypes.includes(mealType));
      if (!covering.length) covering = all.filter(x => x.status === 'Completed' && x.sub.mealTypes.includes(mealType)).slice(0, 1);
      if (!covering.length) continue;

      if (covering.some(x => x.sub.requiresCreditReview)) {
        mealCredits[mealType] = { requiresReview: true };
        continue;
      }
      let allocated = 0, consumed = 0, adjustments = 0;
      for (const item of covering) {
        const s = subs.find((sub) => sub._id.toString() === item.sub._id.toString());
        const cred = balances(s)?.[mealType];
        if (!cred) continue;
        const subAlloc = cred.allocated, subAdj = cred.adjustments, subCons = cred.consumed;

        allocated += subAlloc;
        consumed += subCons;
        adjustments += subAdj;
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

    const expiries = [];
    const expiring = running.filter((x) => x.status === 'Expiring soon');
    let overallStatus = 'No subscription';
    if (running.length) overallStatus = expiring.length ? 'Expiring soon' : 'Active';

    const stats = {
      remaining: running.some(x => x.sub.requiresCreditReview) ? null : running.reduce((sum, x) => sum + x.credit.remaining, 0),
      consumed: running.some(x => x.sub.requiresCreditReview) ? null : running.reduce((sum, x) => sum + x.credit.consumed, 0),
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
    const currentDate = todayStr();
    const today = req.query.date || currentDate;
    if (![currentDate, addDays(currentDate, 1)].includes(today)) return res.status(400).json({ ok: false, message: 'Choose today or tomorrow.' });
    const now = new Date();

    const subs = await Subscription.find({
      user: userId,
      status: { $ne: 'Cancelled' },
      startDate: { $lte: today },
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
        .filter((m) => isServiceDay(today) && m.mealType === mealType)
        .map((m) => ({
          id: m.recordCode || m._id.toString(),
          _id: m._id.toString(),
          subscriptionId: m.subscription.toString(),
          status: m.status,
          cancelledAt: m.cancelledAt ? m.cancelledAt.toISOString() : null,
          cancellable: m.status === 'Scheduled' && now < cutoff,
        }));

      return {
        mealType,
        date: today,
        serviceDay: isServiceDay(today),
        included,
        cutoff,
        entries,
        status: !isServiceDay(today) ? 'No service on Sundays' : entries.length ? null : included ? 'Not scheduled' : 'Not Included',
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

    const meals = await MealRecord.find({ user: userId, date: { $lte: today }, status: { $in: ['Consumed', 'Cancelled'] } })
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
        status: mealHistoryStatus(m),
        creditReviewRequired: needsSundayCreditReview(m),
        cancelledAt: m.cancelledAt,
        cancelledBy: m.cancelledBy,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}
