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
  const mealsHtml = renderToStaticMarkup(React.createElement(TodaysMeals, { now: new Date('2026-10-22T03:00:00Z'), meals: [{ mealType: 'lunch', included: true, cutoff: '2026-10-22T03:30:00.000Z', entries: [{ id: 'booking', status: 'Scheduled', cancellable: true }] }], onCancel: () => {} }));
  assert.match(mealsHtml, /cancel until/);
  for (const [mealType, cutoff] of [['breakfast', '2026-10-21T15:30:00Z'], ['lunch', '2026-10-22T04:30:00Z'], ['dinner', '2026-10-22T13:30:00Z']]) {
    const meals = [{ mealType, included: true, cutoff, entries: [{ id: mealType, status: 'Scheduled', cancellable: true }] }];
    const render = now => renderToStaticMarkup(React.createElement(TodaysMeals, { meals, now, onCancel: () => {} }));
    assert.doesNotMatch(render(new Date(new Date(cutoff) - 1)), /disabled=""/);
    assert.match(render(new Date(cutoff)), /disabled=""/);
    assert.match(render(new Date(new Date(cutoff).getTime() + 1)), /Cancellation closed/);
  }
  const sunday = renderToStaticMarkup(React.createElement(TodaysMeals, { meals: [{ mealType: 'breakfast', included: true,
    serviceDay: false, status: 'No service on Sundays', entries: [] }], onCancel: () => {} }));
  assert.match(sunday, /No service on Sundays/);
  assert.doesNotMatch(sunday, /Cancel Meal/);
  const { default: RecentMeals } = await server.ssrLoadModule('/src/components/dashboard/RecentMeals.jsx');
  const { MealHistory } = await server.ssrLoadModule('/src/components/admin/DetailParts.jsx');
  for (const Component of [RecentMeals, MealHistory]) {
    const html = renderToStaticMarkup(React.createElement(Component, { meals: [{ id: 'sunday', date: '2026-10-25', mealType: 'lunch', status: 'Consumed' }] }));
    assert.match(html, /No service on Sundays/);
    assert.match(html, /Earlier charge needs credit review/);
    assert.doesNotMatch(html, />Consumed</);
    const monday = renderToStaticMarkup(React.createElement(Component, { meals: [{ id: 'monday', date: '2026-10-26', mealType: 'lunch', status: 'Consumed' }] }));
    assert.match(monday, />Consumed</);
  }
  console.log('Dashboard rendering checks passed: backend meal balances and review-required state.');
} finally { await server.close(); }
