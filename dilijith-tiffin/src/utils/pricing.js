// All pricing maths lives here. Components never calculate prices themselves.
export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

const round = (n) => Math.round(n);

export const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function availableMeals(config) {
  return MEAL_KEYS.filter((m) => config.meals?.[m]?.available !== false);
}

/** Returns null when the selection is incomplete or invalid. */
export function calculatePlan(config, durationId, meals) {
  const duration = config.durations.find((d) => d.id === durationId);
  const selected = MEAL_KEYS.filter((m) => meals.includes(m) && config.meals?.[m]?.available !== false);
  if (!duration || selected.length === 0) return null;

  const baseDaily = selected.reduce((sum, m) => sum + Number(config.meals[m].price || 0), 0);
  const comboPercent = Number(config.comboDiscounts?.[selected.length] || 0);
  const dailyCost = round(baseDaily * (1 - comboPercent / 100));
  const subtotal = dailyCost * duration.days;
  const discount = round((subtotal * duration.discountPercent) / 100);
  const total = subtotal - discount;

  return {
    duration,
    meals: selected,
    mealLabels: selected.map((m) => config.meals[m].label),
    baseDaily,
    comboPercent,
    dailyCost,
    subtotal,
    discountPercent: duration.discountPercent,
    discount,
    total,
    monthlyEquivalent: round(total / duration.months),
  };
}

/** Cheapest single-meal monthly equivalent, used for "starting from" previews. */
export function startingMonthly(config, durationId) {
  let best = null;
  for (const m of availableMeals(config)) {
    const plan = calculatePlan(config, durationId, [m]);
    if (plan && (best === null || plan.monthlyEquivalent < best)) best = plan.monthlyEquivalent;
  }
  return best;
}
