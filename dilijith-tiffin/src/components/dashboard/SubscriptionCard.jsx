import StatusBadge from '../admin/StatusBadge';
import WhatsAppButton from './WhatsAppButton';
import { durationLabel, mealsLabel } from '../../utils/adminLogic';
import { planDetails } from '../../utils/userLogic';
import { renewalMessage } from '../../utils/whatsapp';
import { formatDate } from '../../utils/dates';

const Stat = ({ label, value, strong }) => (
  <div>
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className={`font-display text-2xl font-bold ${strong ? 'text-leaf' : ''}`}>{value}</dd>
  </div>
);

export default function SubscriptionCard({ item, customerName, past = false }) {
  const { sub, status, credit, percentUsed } = item;
  const showRenew = status === 'Completed';
  const warn = false;

  return (
    <article className={`rounded-xl border bg-white p-5 ${warn ? 'border-accent' : 'border-line'} ${past ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl leading-tight">{durationLabel(sub.durationMonths)}</h3>
          <p className="text-sm text-muted">{mealsLabel(sub.mealTypes)} · {sub.id}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <dt className="text-xs font-semibold text-muted">Start date</dt>
          <dd className="text-sm font-semibold">{formatDate(sub.startDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Validity</dt>
          <dd className={`text-sm font-semibold ${warn ? 'text-amber' : ''}`}>Until credits are used</dd>
        </div>
        <Stat label="Allocated credits" value={credit.entitlement} />
        <Stat label="Consumed" value={credit.consumed} />
        <Stat label="Remaining" value={credit.remaining ?? "Review required"} strong />
      </dl>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Credits used</span><span>{credit.consumed} of {credit.entitlement} ({percentUsed}%)</span>
        </div>
        <div role="progressbar" aria-label="Credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentUsed}
          className="h-2 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full ${percentUsed >= 90 ? 'bg-accent' : 'bg-brand'}`} style={{ width: `${percentUsed}%` }} />
        </div>
      </div>

      {showRenew && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className={`text-sm ${warn ? 'text-amber' : 'text-muted'}`}>
            All meal credits have been used. Renewals are handled on WhatsApp.
          </p>
          <WhatsAppButton label="Renew via WhatsApp" message={renewalMessage({ name: customerName, plan: planDetails(sub) })} variant="primary" />
        </div>
      )}
    </article>
  );
}
