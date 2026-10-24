import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { MealCreditBadge } = await server.ssrLoadModule('/src/pages/user/UserDashboard.jsx');
  for (const [mealType, remaining] of [['breakfast', 7], ['lunch', 19], ['dinner', 0]]) {
    const html = renderToStaticMarkup(React.createElement(MealCreditBadge, { mealType, credit: { entitlement: 20, consumed: 20 - remaining, remaining } }));
    assert.match(html, new RegExp(`>${remaining}</dd>`));
    assert.match(html, /Remaining/);
  }
  const review = renderToStaticMarkup(React.createElement(MealCreditBadge, { mealType: 'lunch', credit: { requiresReview: true } }));
  assert.match(review, /Allocation requires review/);
  assert.doesNotMatch(review, /NaN|undefined|>0<|Not in your plan/);
  const { default: TodaysMeals } = await server.ssrLoadModule('/src/components/dashboard/TodaysMeals.jsx');
  const mealsHtml = renderToStaticMarkup(React.createElement(TodaysMeals, { meals: [{ mealType: 'lunch', included: true, cutoff: '2026-10-22T03:30:00.000Z', entries: [{ id: 'booking', status: 'Scheduled', cancellable: true }] }], onCancel: () => {} }));
  assert.match(mealsHtml, /cancel until/);
  console.log('Dashboard rendering checks passed: backend meal balances and review-required state.');
} finally { await server.close(); }
