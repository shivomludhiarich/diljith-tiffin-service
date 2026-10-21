import { Check, MessageCircle } from 'lucide-react';
import { formatINR } from '../../utils/pricing';
import { buildMealWhatsappUrl } from '../../utils/whatsapp';
import { BRAND } from '../../config/brand';

const STYLE = {
  black: {
    card: 'bg-[#0A0A0A] text-white border border-white/10 shadow-lg',
    sub: 'text-white/80',
    divider: 'border-white/15',
    check: 'text-white',
    btn: 'border border-white/40 text-white hover:border-white hover:bg-white/10',
    badge: 'bg-white text-ink',
  },
  green: {
    card: 'bg-brand text-white shadow-xl ring-2 ring-brand/40',
    sub: 'text-white/90',
    divider: 'border-white/20',
    check: 'text-white',
    btn: 'bg-white text-brand hover:bg-bg2 shadow-md',
    badge: 'bg-white text-brand',
  },
  orange: {
    card: 'bg-[#E27800] text-white shadow-xl',
    sub: 'text-white/95',
    divider: 'border-white/20',
    check: 'text-white',
    btn: 'bg-white text-[#E27800] hover:bg-bg2 shadow-md',
    badge: 'bg-white text-[#E27800]',
  },
  light: {
    card: 'bg-white text-ink border-2 border-line/90 shadow-lg hover:border-brand/40',
    sub: 'text-muted',
    divider: 'border-line',
    check: 'text-brand',
    btn: 'bg-ink text-white hover:bg-black shadow-md hover:shadow-lg',
    badge: 'bg-bg2 text-ink',
  },
};

const BTN = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all';

export default function MealPricingCard({ rate, selected, onSelect }) {
  const s = STYLE[rate.tone] ?? STYLE.black;
  const whatsappUrl = buildMealWhatsappUrl(rate.title, rate.price, BRAND.whatsappNumber);

  return (
    <div
      className={`relative flex min-h-[29rem] flex-col rounded-3xl p-7 transition-transform hover:-translate-y-1 ${s.card} ${
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

      <div className="mt-auto pt-8">
        <a
          href={whatsappUrl || BRAND.social?.find((s) => s.label === 'WhatsApp')?.href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN} ${s.btn}`}
          aria-label={`Enquire about ${rate.title} at ${formatINR(rate.price)} on WhatsApp (opens in new tab)`}
        >
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Enquire on WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
