import { mealHistoryStatus, needsSundayCreditReview } from '../../utils/serviceDays';
import StatusBadge from '../admin/StatusBadge';
import EmptyState from '../common/EmptyState';
import { mealLabel } from '../../utils/adminLogic';
import { formatDate } from '../../utils/dates';

export default function RecentMeals({ meals }) {
  if (!meals.length) return <EmptyState title="No meal activity yet" message="Your meals will appear here once your plan starts." />;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {meals.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">{formatDate(m.date)}</span> · {mealLabel(m.mealType)}
            {m.status === 'Cancelled' && m.cancelledAt && (
              <span className="block text-xs text-muted">
                Cancelled {new Date(m.cancelledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </span>
          <div><StatusBadge status={mealHistoryStatus(m)} />{needsSundayCreditReview(m) && <p className="mt-1 text-xs text-amber">Earlier charge needs credit review</p>}</div>
        </li>
      ))}
    </ul>
  );
}
