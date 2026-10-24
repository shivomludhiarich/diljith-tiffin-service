import { Coffee, Moon, Sun } from 'lucide-react';
import Button from '../common/Button';
import StatusBadge from '../admin/StatusBadge';
import { mealLabel } from '../../utils/adminLogic';

const ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon };
const fmt = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fmtTime = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Entry({ meal, entry, showPlan, onCancel }) {
  const reasonId = `closed-${entry.id}`;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={entry.status} />
        {showPlan && <span className="text-xs text-muted">{entry.subscriptionId}</span>}
      </div>

      {entry.status === 'Scheduled' && (
        <>
          <p id={reasonId} className="mt-2 text-xs text-muted">
            {entry.cancellable
              ? `You can cancel until ${fmt(meal.cutoff)}. Your credit stays with your plan.`
              : `Cancellation closed on ${fmt(meal.cutoff)}, so this meal can no longer be cancelled.`}
          </p>
          <Button variant={entry.cancellable ? 'outline' : 'ghost'} className="mt-3 h-10 w-full" disabled={!entry.cancellable}
            aria-describedby={reasonId} onClick={() => onCancel(meal, entry)}>
            Cancel Meal
          </Button>
        </>
      )}
      {entry.status === 'Cancelled' && (
        <p className="mt-2 text-xs text-muted">{entry.cancelledAt ? `Cancelled on ${fmtTime(entry.cancelledAt)}. Your credit was kept.` : 'Cancelled. Your credit was kept.'}</p>
      )}
      {entry.status === 'Consumed' && <p className="mt-2 text-xs text-muted">Enjoyed today. This meal used one credit.</p>}
    </div>
  );
}

export default function TodaysMeals({ meals, onCancel }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {meals.map((meal) => {
        const Icon = ICONS[meal.mealType];
        return (
          <article key={meal.mealType} className={`rounded-xl border border-line bg-white p-5 ${meal.included ? '' : 'opacity-75'}`}>
            <div className="flex items-center gap-3">
              <Icon className={`h-6 w-6 ${meal.included ? 'text-amber' : 'text-muted'}`} aria-hidden="true" />
              <div>
                <h3 className="text-xl leading-tight">{mealLabel(meal.mealType)}</h3>
                <p className="text-xs text-muted">{meal.included ? 'Included in your plan' : 'Not in your plan'}</p>
              </div>
            </div>

            {meal.entries.length === 0 ? (
              <div className="mt-3 border-t border-line pt-3">
                <StatusBadge status={meal.status} />
                <p className="mt-2 text-xs text-muted">
                  {meal.included ? 'No meal is scheduled for today. Your credits may be used up.' : 'Add this meal to your plan by contacting us.'}
                </p>
              </div>
            ) : (
              meal.entries.map((entry) => (
                <Entry key={entry.id} meal={meal} entry={entry} showPlan={meal.entries.length > 1} onCancel={onCancel} />
              ))
            )}
          </article>
        );
      })}
    </div>
  );
}
