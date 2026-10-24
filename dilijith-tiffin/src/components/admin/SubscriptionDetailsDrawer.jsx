import Drawer from './Drawer';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';
import { AdjustmentList, CreditBreakdown, Field, MealHistory, Section } from './DetailParts';
import { useAdminData } from '../../context/AdminDataContext';
import { durationLabel, isCancellable, isRenewable, mealsLabel, recentMeals, subscriptionStatus } from '../../utils/adminLogic';
import { formatDate, formatDateTime } from '../../utils/dates';

export default function SubscriptionDetailsDrawer({ subId, onClose, onOpenUser, onRenew, onCancel }) {
  const { state, today, credits } = useAdminData();
  const sub = state.subscriptions.find((s) => s.id === subId);
  if (!sub) return null;

  const user = state.users.find((u) => u.id === sub.userId);
  const status = subscriptionStatus(sub, today);
  const credit = credits[sub.id];

  return (
    <Drawer open onClose={onClose} title={sub.id} subtitle={user ? `${user.name} · ${user.email}` : 'Unknown user'}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {user && <Button variant="outline" onClick={() => onOpenUser(user.id)}>Open user details</Button>}
        {isRenewable(sub, today) && <Button onClick={() => onRenew(sub)}>Renew</Button>}
        {isCancellable(sub, today) && <Button variant="danger" onClick={() => onCancel(sub)}>Cancel subscription</Button>}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-white p-4">
        <Field label="Plan">{durationLabel(sub.durationMonths)}</Field>
        <Field label="Meal types">{mealsLabel(sub.mealTypes)}</Field>
        <Field label="Start date">{formatDate(sub.startDate)}</Field>
        <Field label="End date">{formatDate(sub.endDate)}</Field>
        <Field label="Created">{formatDateTime(sub.createdAt)}</Field>
        <Field label="Demo price">{sub.demoPrice ? `₹${sub.demoPrice.toLocaleString('en-IN')}` : null}</Field>
        {sub.cancelledAt && <Field label="Cancelled">{formatDateTime(sub.cancelledAt)}{sub.cancelReason ? ` · ${sub.cancelReason}` : ''}</Field>}
      </dl>

      <Section title="Meal credits">{sub.requiresCreditReview ? <p role="alert">Original allocations require review.</p> : sub.mealTypes.map(t => <div key={t}><h3>{t}</h3><CreditBreakdown credit={sub.balances[t]} /></div>)}</Section>
      <Section title="Credit ledger"><ul>{(state.ledger || []).filter(e => String(e.subscription) === sub._id).map(e => <li key={e._id} className="py-2 text-sm">{formatDateTime(e.createdAt)} ? {e.mealType} ? {e.operation} ? {e.delta > 0 ? '+' : ''}{e.delta}{e.reason ? ` ? ${e.reason}` : ''}</li>)}</ul></Section>
      <Section title="Credit adjustments"><AdjustmentList adjustments={state.adjustments.filter((a) => a.subscriptionId === sub.id)} /></Section>

      {sub.renewals?.length > 0 && (
        <Section title="Renewals">
          <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {[...sub.renewals].reverse().map((r) => (
              <li key={r.id} className="px-3 py-2">
                {formatDateTime(r.renewedAt)} · {formatDate(r.previousEndDate)} to {formatDate(r.newEndDate)} · +{r.creditsAdded} meals
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recent meal history"><MealHistory meals={recentMeals(state, { subscriptionId: sub.id }, 10)} /></Section>
    </Drawer>
  );
}
