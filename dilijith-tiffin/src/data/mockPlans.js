// SINGLE SOURCE OF TRUTH for demo pricing (Indian rupees). Admin > Manage Plans edits a copy of this in localStorage.
//
// Formula (see utils/pricing.js):
//   baseDaily   = sum of selected per-meal prices
//   dailyCost   = baseDaily - combo discount (by number of meals selected)
//   subtotal    = dailyCost x days in the duration
//   discount    = subtotal x duration discount %
//   final       = subtotal - discount
export const DEFAULT_PRICING = {
  currency: 'INR',
  meals: {
    breakfast: { label: 'Breakfast', price: 50, available: true },
    lunch: { label: 'Lunch', price: 90, available: true },
    dinner: { label: 'Dinner', price: 80, available: true },
  },
  // keys = number of meals selected, values = % off the daily total
  comboDiscounts: { 1: 0, 2: 5, 3: 8 },
  durations: [
    { id: '1m', label: '1 Month', months: 1, days: 30, discountPercent: 0, available: true,
      description: 'Try the service with no long-term commitment.' },
    { id: '3m', label: '3 Months', months: 3, days: 90, discountPercent: 5, available: true, recommended: true,
      description: 'A steady routine at a better daily rate.' },
    { id: '6m', label: '6 Months', months: 6, days: 180, discountPercent: 10, available: true,
      description: 'Best value for everyday home-style meals.' },
  ],
};

/**
 * Official Customer-Facing Rate List (organized by meal type).
 * Prices in INR with authentic North Indian culinary preparation.
 */
export const MEAL_RATES = [
  {
    id: 'lunch-only',
    title: 'Lunch Only',
    mealOption: 'Lunch only',
    price: 2600,
    description: 'A plan for customers who need lunch.',
    features: [
      'Authentic North Indian lunch',
      'Freshly prepared everyday dining',
      'Free delivery included',
      'Meal carry-forward policy',
    ],
    recommended: true,
    tone: 'green',
  },
  {
    id: 'dinner-only',
    title: 'Dinner Only',
    mealOption: 'Dinner only',
    price: 2600,
    description: 'A plan for customers who need dinner.',
    features: [
      'Authentic North Indian dinner',
      'Freshly prepared everyday dining',
      'Free delivery included',
      'Meal carry-forward policy',
    ],
    recommended: false,
    tone: 'orange',
  },
  {
    id: 'breakfast-only',
    title: 'Breakfast Only',
    mealOption: 'Breakfast only',
    price: 2000,
    description: 'A plan for customers who need breakfast.',
    features: [
      'Wholesome North Indian breakfast',
      'Freshly prepared everyday dining',
      'Free delivery included',
      'Meal carry-forward policy',
    ],
    recommended: false,
    tone: 'black',
  },
  {
    id: 'individual-meal',
    title: 'Individual Meal',
    mealOption: 'Individual meal',
    price: 150,
    description: 'A meal purchased individually.',
    features: [
      'Single meal order',
      'Freshly prepared authentic taste',
      'Free delivery included',
      'Flexible order on demand',
    ],
    recommended: false,
    tone: 'light',
  },
];

