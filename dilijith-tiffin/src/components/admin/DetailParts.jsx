import StatusBadge from './StatusBadge';
import { formatDate, formatDateTime } from '../../utils/dates';
import { mealLabel } from '../../utils/adminLogic';

export const Section = ({ title, children, action }) => (
  <section>
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-lg">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

export const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className="break-words text-sm">{children || '-'}</dd>
  </div>
);

/** The same five numbers everywhere: initial allocation, adjustments, entitlement, consumed, remaining. */
export function CreditBreakdown({ credit }) {
  const cells = [
    ['Initial allocation', credit.allocated],
    ['Net adjustments', `${credit.adjustments > 0 ? '+' : ''}${credit.adjustments}`],
    ['Total entitlement', credit.entitlement],
    ['Meals consumed', credit.consumed],
    ['Meals remaining', credit.remaining],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
      {cells.map(([label, value], i) => (
        <div key={label} className="bg-white p-3">
          <dt className="text-xs font-semibold text-muted">{label}</dt>
          <dd className={`font-display text-2xl font-bold ${i === 4 ? 'text-leaf' : ''}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MealHistory({ meals, showSub = false }) {
  if (!meals.length) return <p className="text-sm text-muted">No meal records yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
      {meals.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span>{formatDate(m.date)} · {mealLabel(m.mealType)}{showSub && <span className="text-muted"> · {m.subscriptionId}</span>}</span>
          <StatusBadge status={m.status} />
        </li>
      ))}
    </ul>
  );
}

export function AdjustmentList({ adjustments }) {
  if (!adjustments.length) return <p className="text-sm text-muted">No credit adjustments yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
      {[...adjustments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => (
        <li key={a.id} className="px-3 py-2">
          <div className="flex justify-between gap-3">
            <span className={`font-bold ${a.amount > 0 ? 'text-leaf' : 'text-danger'}`}>{a.amount > 0 ? '+' : ''}{a.amount} meals</span>
            <span className="text-muted">{formatDateTime(a.createdAt)}</span>
          </div>
          <p className="text-muted">{a.reason} · {a.subscriptionId}</p>
        </li>
      ))}
    </ul>
  );
}
