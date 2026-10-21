import { useMemo, useRef, useState } from 'react';
import { Coffee, Moon, Sun } from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import SubscriptionCard from '../../components/dashboard/SubscriptionCard';
import TodaysMeals from '../../components/dashboard/TodaysMeals';
import RecentMeals from '../../components/dashboard/RecentMeals';
import WhatsAppButton from '../../components/dashboard/WhatsAppButton';
import AddressEditor from '../../components/dashboard/AddressEditor';
import { useAuth } from '../../context/AuthContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../../context/ToastContext';
import useNow from '../../hooks/useNow';
import { mealLabel, uid } from '../../utils/adminLogic';
import { planDetails, recentMealActivity, todaysMeals, userSummary } from '../../utils/userLogic';
import { renewalMessage } from '../../utils/whatsapp';
import { diffDays, formatDate, todayStr } from '../../utils/dates';

const MEAL_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon };
const MEAL_COLORS = { breakfast: 'text-amber', lunch: 'text-leaf', dinner: 'text-brand' };

/** Compact per-meal credit badge shown inside the meal-credit breakdown section. */
function MealCreditBadge({ mealType, credit }) {
  const Icon = MEAL_ICONS[mealType];
  const color = MEAL_COLORS[mealType] ?? 'text-muted';
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
        <span className="text-sm font-semibold">{mealLabel(mealType)}</span>
      </div>
      {credit ? (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted">Allocated</dt>
            <dd className="font-display text-xl font-bold">{credit.entitlement}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Consumed</dt>
            <dd className="font-display text-xl font-bold">{credit.consumed}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Remaining</dt>
            <dd className={`font-display text-xl font-bold ${credit.remaining > 0 ? 'text-leaf' : 'text-muted'}`}>{credit.remaining}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted">Not in your plan</p>
      )}
    </div>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();
  const { state, cancelMeal } = useAdminData();
  const { notify } = useToast();
  const now = useNow();
  const today = todayStr(now);

  const summary = useMemo(() => userSummary(state, user.id, today), [state, user.id, today]);
  const meals = useMemo(() => todaysMeals(state, user.id, today, now), [state, user.id, today, now]);
  const recent = useMemo(() => recentMealActivity(state, user.id, today, 8), [state, user.id, today]);

  const [pending, setPending] = useState(null); // { meal, entry }
  const [busy, setBusy] = useState(false);
  const opId = useRef(null);

  const askCancel = (meal, entry) => { opId.current = uid('op'); setPending({ meal, entry }); };
  const confirmCancel = () => {
    if (busy || !pending) return;
    setBusy(true);
    const result = cancelMeal(user.id, pending.entry.id, opId.current);
    notify(result.ok ? `${mealLabel(pending.meal.mealType)} cancelled. Your credit was kept.` : result.errors?.form ?? 'Could not cancel this meal.', result.ok ? 'success' : 'error');
    setPending(null);
    setBusy(false);
  };

  const { running, past, stats, mealCredits, nearestExpiry, overallStatus, expiring } = summary;
  const firstName = (user.name || 'there').split(' ')[0];
  const daysToExpiry = nearestExpiry ? diffDays(nearestExpiry, today) : null;
  const expiringItem = expiring[0];
  const nothingYet = running.length === 0 && past.length === 0;

  // Build a summary line using per-meal balances where available
  const mealSummaryParts = ['breakfast', 'lunch', 'dinner']
    .filter((m) => mealCredits[m])
    .map((m) => `${mealCredits[m].remaining} ${mealLabel(m)}`);
  const mealSummaryText = mealSummaryParts.length
    ? `${mealSummaryParts.join(', ')} remaining`
    : `${stats.remaining} meal${stats.remaining === 1 ? '' : 's'} remaining`;

  return (
    <div className="container-x py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Hello, {firstName}</h1>
          <p className="mt-2 max-w-xl text-muted">
            {running.length
              ? `You have ${running.length} active subscription${running.length === 1 ? '' : 's'} with ${mealSummaryText}.`
              : 'You don\u2019t have a running subscription right now.'}
          </p>
        </div>
        <StatusBadge status={overallStatus} />
      </header>

      {nothingYet ? (
        <div className="mt-8">
          <EmptyState
            title="No subscription yet"
            message="Subscriptions are set up by our team. Message us on WhatsApp and we will get you started."
            action={<WhatsAppButton label="Contact us on WhatsApp" variant="primary"
              message={`Hello, I would like to know about the Dilijith Tiffin Service plans. My name is ${user.name}.`} />}
          />
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Meals remaining" value={stats.remaining} tone="green" hint="Total remaining across all active plans" />
            <StatCard label="Meals consumed" value={stats.consumed} hint="On your active plans" />
            <StatCard label="Meals cancelled" value={stats.cancelled} hint="Cancelled by you in time, credit kept" />
            <StatCard label="Active subscriptions" value={stats.activeSubscriptions} hint="Expired plans are not counted" />
          </section>

          {/* Per-meal credit breakdown — independent balances */}
          <section aria-labelledby="meal-credits-title" className="mt-6">
            <h2 id="meal-credits-title" className="mb-3 text-xl font-semibold">Credits by meal type</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                <MealCreditBadge key={mealType} mealType={mealType} credit={mealCredits[mealType]} />
              ))}
            </div>
          </section>

          {nearestExpiry && (
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-3 text-sm ${daysToExpiry <= 7 ? 'border-accent' : 'border-line'}`}>
              <p>
                <span className="font-semibold">Next expiry:</span> {formatDate(nearestExpiry)}{' '}
                <span className={daysToExpiry <= 7 ? 'font-semibold text-amber' : 'text-muted'}>
                  ({daysToExpiry === 0 ? 'today' : `in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`})
                </span>
              </p>
              {expiringItem && (
                <WhatsAppButton label="Renew via WhatsApp" variant="primary"
                  message={renewalMessage({ name: user.name, plan: planDetails(expiringItem.sub) })} />
              )}
            </div>
          )}

          <section aria-labelledby="today-title" className="mt-10">
            <h2 id="today-title" className="mb-3 text-2xl">Today&apos;s meals</h2>
            <TodaysMeals meals={meals} onCancel={askCancel} />
          </section>

          <section aria-labelledby="subs-title" className="mt-10">
            <h2 id="subs-title" className="mb-3 text-2xl">Running subscriptions</h2>
            {running.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {running.map((item) => <SubscriptionCard key={item.sub.id} item={item} customerName={user.name} />)}
              </div>
            ) : (
              <EmptyState title="No running subscription" message="Your previous plans are listed below. Renew on WhatsApp to continue your meals." />
            )}

            {past.length > 0 && (
              <details className="mt-4 rounded-xl border border-line bg-bg2 p-4" open={running.length === 0}>
                <summary className="cursor-pointer text-sm font-bold">Past subscriptions ({past.length})</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {past.map((item) => <SubscriptionCard key={item.sub.id} item={item} customerName={user.name} past />)}
                </div>
              </details>
            )}
          </section>

          <section aria-labelledby="recent-title" className="mt-10">
            <h2 id="recent-title" className="mb-3 text-2xl">Recent meal activity</h2>
            <RecentMeals meals={recent} />
          </section>
        </>
      )}

      {/* Address editor — always visible so users without an address can add one */}
      <AddressEditor address={user.address ?? null} />

      {pending && (
        <ConfirmDialog open busy={busy} title={`Cancel today's ${pending.meal.mealType}?`} confirmLabel="Cancel meal" danger
          onConfirm={confirmCancel} onClose={() => setPending(null)}>
          <p>Your {pending.meal.mealType} for {formatDate(today)} will be cancelled and our kitchen will be told.</p>
          <p>Your credit stays with your plan. You can&apos;t undo this here, so message us on WhatsApp if you change your mind.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
