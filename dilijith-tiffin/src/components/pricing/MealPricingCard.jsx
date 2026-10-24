import { Check } from 'lucide-react';
import { formatINR } from '../../utils/pricing';

const STYLE = {
  black: {
    card: 'bg-[#0A0A0A] text-white border border-white/10 shadow-lg',
    sub: 'text-white/80',
    divider: 'border-white/15',
    check: 'text-white',
    badge: 'bg-white text-ink',
  },
  green: {
    card: 'bg-brand text-white shadow-xl ring-2 ring-brand/40',
    sub: 'text-white/90',
    divider: 'border-white/20',
    check: 'text-white',
    badge: 'bg-white text-brand',
  },
  orange: {
    card: 'bg-[#E27800] text-white shadow-xl',
    sub: 'text-white/95',
    divider: 'border-white/20',
    check: 'text-white',
    badge: 'bg-white text-[#E27800]',
  },
  light: {
    card: 'bg-white text-ink border-2 border-line/90 shadow-lg hover:border-brand/40',
    sub: 'text-muted',
    divider: 'border-line',
    check: 'text-brand',
    badge: 'bg-bg2 text-ink',
  },
};


export default function MealPricingCard({ rate, selected, onSelect }) {
  const s = STYLE[rate.tone] ?? STYLE.black;

  return (
    <div
      className={`relative flex min-h-[24rem] flex-col rounded-3xl p-7 transition-transform hover:-translate-y-1 ${s.card} ${
        selected ? 'ring-2 ring-ink ring-offset-4 ring-offset-bg' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-2xl font-bold sm:text-3xl">{rate.title}</h3>
        {rate.recommended && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${s.badge}`}>
            <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
            Recommended
          </span>
        )}
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${s.sub}`}>{rate.description}</p>

      <div className={`mt-6 border-t ${s.divider} pt-6`}>
        <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">
          {formatINR(rate.price)}
        </p>
      </div>

      <ul className={`mt-6 space-y-2.5 text-sm ${s.sub}`}>
        {rate.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${s.check}`} aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>


    </div>
  );
}
