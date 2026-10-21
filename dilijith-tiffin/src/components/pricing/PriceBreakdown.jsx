import { formatINR } from '../../utils/pricing';

function Row({ label, value, strong, good }) {
  return (
    <div className={`flex justify-between gap-4 py-2 ${strong ? 'border-t border-line pt-3 text-lg font-bold' : ''}`}>
      <dt className="text-muted">{label}</dt>
      <dd className={good ? 'text-leaf' : strong ? 'text-amber' : ''}>{value}</dd>
    </div>
  );
}

export default function PriceBreakdown({ plan }) {
  if (!plan) return null;
  return (
    <dl className="text-sm">
      <Row label="Duration" value={plan.duration.label} />
      <Row label="Meals" value={plan.mealLabels.join(' + ')} />
      <Row label="Daily meal cost" value={`${formatINR(plan.dailyCost)}${plan.comboPercent ? ` (after ${plan.comboPercent}% combo discount)` : ''}`} />
      <Row label="Estimated monthly equivalent" value={formatINR(plan.monthlyEquivalent)} />
      <Row label={`Subtotal (${plan.duration.days} days)`} value={formatINR(plan.subtotal)} />
      <Row label={`Duration discount (${plan.discountPercent}%)`} value={plan.discount ? `- ${formatINR(plan.discount)}` : formatINR(0)} good={plan.discount > 0} />
      <Row label="Final estimated price" value={formatINR(plan.total)} strong />
    </dl>
  );
}
