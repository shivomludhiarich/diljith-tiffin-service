import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

// A render-triggered refresh unmounts the route via AdminLayout's loading screen,
// then remounts it after the fetch, creating an endless loading loop.
const server = await createServer({
  server: { middlewareMode: true }, appType: 'custom',
  plugins: [{
    name: 'admin-loading-fixtures', enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/context/AdminDataContext.jsx')) return `
        export let fixture;
        export const setFixture = value => { fixture = value; };
        export const useAdminData = () => fixture;
      `;
      if (id.replaceAll('\\', '/').endsWith('/context/ToastContext.jsx')) return `
        export const useToast = () => ({ notify() {} });
      `;
    },
  }],
});
try {
  const { setFixture } = await server.ssrLoadModule('/src/context/AdminDataContext.jsx');
  const users = [{ id: 'customer', name: 'Loading Regression Customer', hasAddress: true }];
  const subscriptions = [{ id: 'subscription-regression', userId: 'customer', startDate: '2026-10-01', endDate: '2026-11-01', durationMonths: 1, mealTypes: ['lunch'], status: 'Active' }];
  for (const populated of [false, true]) {
    const state = { users: populated ? users : [], subscriptions: populated ? subscriptions : [], mealRecords: [], adjustments: [] };
    setFixture({ state, ...state, today: '2026-10-23', credits: { 'subscription-regression': { entitlement: 20, allocated: 20, adjustments: 0, consumed: 2, remaining: 18 } },
      refreshFromBackend() { assert.fail('Pages must not refresh shared data during rendering'); },
    });
    for (const page of ['Users', 'Subscriptions']) {
      const { default: Page } = await server.ssrLoadModule(`/src/pages/admin/Admin${page}.jsx`);
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
      assert.match(html, new RegExp(`>${page}</h1>`));
      assert.match(html, populated ? /Loading Regression Customer/ : /No (users|subscriptions) match/);
      if (populated) assert.match(html, />18</);
    }
  }
  console.log('Admin Users and Subscriptions render with empty and populated data without triggering refreshes.');
} finally { await server.close(); }
