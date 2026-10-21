import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_MENU } from '../data/mockMenu';
import { DEFAULT_PRICING, MEAL_RATES } from '../data/mockPlans';
import { KEYS, readJSON, writeJSON } from '../utils/storage';
import { MEAL_KEYS, calculatePlan } from '../utils/pricing';

// Shared mock "database". Every page reads from here; localStorage keeps it across refreshes.
const AppDataContext = createContext(null);

const validMenu = (m) => Array.isArray(m) && m.every((i) => i && i.id && i.name && i.category);
const validPricing = (p) =>
  p && Array.isArray(p.durations) && p.durations.length > 0 && p.comboDiscounts &&
  MEAL_KEYS.every((k) => p.meals?.[k] && typeof p.meals[k].price === 'number');

const load = (key, fallback, isValid) => {
  const stored = readJSON(key, null);
  return stored !== null && isValid(stored) ? stored : fallback;
};

const DEFAULT_SELECTION = { durationId: '3m', meals: ['lunch'] };

export function AppDataProvider({ children }) {
  const [menu, setMenu] = useState(() => load(KEYS.menu, DEFAULT_MENU, validMenu));
  const [pricing, setPricing] = useState(() => load(KEYS.pricing, DEFAULT_PRICING, validPricing));
  const [selection, setSelection] = useState(() =>
    load(KEYS.selection, DEFAULT_SELECTION, (s) => s && typeof s.durationId === 'string' && Array.isArray(s.meals)));
  const [subscription, setSubscription] = useState(() => readJSON(KEYS.subscription, null));

  useEffect(() => writeJSON(KEYS.menu, menu), [menu]);
  useEffect(() => writeJSON(KEYS.pricing, pricing), [pricing]);
  useEffect(() => writeJSON(KEYS.selection, selection), [selection]);
  useEffect(() => writeJSON(KEYS.subscription, subscription), [subscription]);

  // Menu CRUD (used by Admin > Manage Menu in Stage 5)
  const addMenuItem = useCallback((item) => setMenu((m) => [...m, { ...item, id: `m${Date.now()}` }]), []);
  const updateMenuItem = useCallback((id, patch) => setMenu((m) => m.map((i) => (i.id === id ? { ...i, ...patch } : i))), []);
  const deleteMenuItem = useCallback((id) => setMenu((m) => m.filter((i) => i.id !== id)), []);

  const activateSubscription = useCallback(() => {
    const plan = calculatePlan(pricing, selection.durationId, selection.meals);
    if (!plan) return null;
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + plan.duration.days);
    const sub = {
      durationId: plan.duration.id,
      durationLabel: plan.duration.label,
      meals: plan.meals,
      mealLabels: plan.mealLabels,
      total: plan.total,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
    setSubscription(sub);
    return sub;
  }, [pricing, selection]);

  const resetDemoData = useCallback(() => {
    setMenu(DEFAULT_MENU);
    setPricing(DEFAULT_PRICING);
    setSelection(DEFAULT_SELECTION);
    setSubscription(null);
  }, []);

  const value = useMemo(
    () => ({
      menu, pricing, mealRates: MEAL_RATES, selection, subscription,
      setPricing, setSelection, addMenuItem, updateMenuItem, deleteMenuItem,
      activateSubscription, resetDemoData,
    }),
    [menu, pricing, selection, subscription, addMenuItem, updateMenuItem, deleteMenuItem, activateSubscription, resetDemoData]
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
};
