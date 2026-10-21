import { Check, Coffee, Moon, Sun } from 'lucide-react';
import { MEAL_KEYS, formatINR } from '../../utils/pricing';

const ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon };

export default function MealSelector({ pricing, selected, onToggle }) {
  return (
    <div role="group" aria-label="Choose meals" className="grid gap-3 sm:grid-cols-3">
      {MEAL_KEYS.map((key) => {
        const meal = pricing.meals[key];
        const Icon = ICONS[key];
        const disabled = meal.available === false;
        const on = selected.includes(key) && !disabled;
        return (
          <button
            key={key}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              on ? 'border-brand bg-white ring-1 ring-brand' : 'border-line bg-bg2 hover:border-brand/60'
            }`}
          >
            <Icon className={`h-6 w-6 ${on ? 'text-brand' : 'text-muted'}`} aria-hidden="true" />
            <span>
              <span className="block font-display text-lg font-semibold">{meal.label}</span>
              <span className="text-sm text-muted">{disabled ? 'Not available' : `${formatINR(meal.price)} / day`}</span>
            </span>
            {on && <Check className="absolute right-3 top-3 h-5 w-5 text-brand" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
