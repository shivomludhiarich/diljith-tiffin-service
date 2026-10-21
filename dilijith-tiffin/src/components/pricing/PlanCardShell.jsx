import { Check } from 'lucide-react';

export const TONES = ['black', 'green', 'orange'];

const STYLE = {
  black: { card: 'bg-[#0A0A0A] text-white', sub: 'text-white/75', btn: 'border border-white/40 text-white hover:border-white hover:bg-white/10' },
  green: { card: 'bg-brand text-white', sub: 'text-white/95', btn: 'bg-white text-ink hover:bg-bg2' },
  orange: { card: 'bg-[#E27800] text-white', sub: 'text-white', btn: 'bg-white text-ink hover:bg-bg2' },
};
const BTN = 'inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold transition-colors';

export const planFeatures = (d) => [
  'Any single meal or combination',
  d.discountPercent ? `${d.discountPercent}% off the ${d.label.toLowerCase()} total` : 'Standard daily rate',
  `${d.days} days of fresh home-cooked tiffins`,
];

/** Shared look for every plan card. `children` is a render function that receives button/text classes. */
export default function PlanCardShell({ tone, title, description, recommended, features, selected, children }) {
  const s = STYLE[tone] ?? STYLE.black;
  return (
    <div className={`flex min-h-[30rem] flex-col rounded-3xl p-7 ${s.card} ${selected ? 'ring-2 ring-ink ring-offset-4 ring-offset-bg' : ''}`}>
      <h3 className="text-3xl leading-tight sm:text-4xl">{title}</h3>
      {recommended && (
        <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink">
          <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />Recommended
        </span>
      )}
      <p className={`mt-3 ${s.sub}`}>{description}</p>
      <ul className={`mt-8 space-y-2 ${s.sub}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />{f}</li>
        ))}
      </ul>
      <div className="mt-auto pt-8">{children({ btn: `${BTN} ${s.btn}`, sub: s.sub })}</div>
    </div>
  );
}
