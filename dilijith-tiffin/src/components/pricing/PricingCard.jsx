import PlanCardShell, { planFeatures } from './PlanCardShell';
import { formatINR } from '../../utils/pricing';

export default function PricingCard({ tone, duration, plan, selected, onSelect, onChoose }) {
  return (
    <PlanCardShell
      tone={tone}
      title={duration.label}
      description={duration.description}
      recommended={duration.recommended}
      features={planFeatures(duration)}
      selected={selected}
    >
      {({ btn, sub }) => (
        <>
          {plan ? (
            <>
              <p className="font-display text-4xl font-bold">{formatINR(plan.total)}</p>
              <p className={`text-sm ${sub}`}>about {formatINR(plan.monthlyEquivalent)} / month</p>
            </>
          ) : (
            <p className={sub}>Select at least one meal to see the price.</p>
          )}
          <button type="button" onClick={onChoose} className={`${btn} mt-5`}>Choose Plan</button>
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`mt-3 w-full text-center text-sm font-semibold underline underline-offset-4 ${sub}`}
          >
            {selected ? 'Showing breakdown below' : 'See price breakdown'}
          </button>
        </>
      )}
    </PlanCardShell>
  );
}
