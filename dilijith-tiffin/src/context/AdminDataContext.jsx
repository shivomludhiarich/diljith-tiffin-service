import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAppData } from './AppDataContext';
import { useAuth } from './AuthContext';
import { todayStr } from '../utils/dates';
import { api } from '../services/api';
const AdminDataContext = createContext(null);
const empty = () => ({ users: [], subscriptions: [], mealRecords: [], adjustments: [], activity: [], ledger: [] });
export function AdminDataProvider({ children }) {
  const { pricing } = useAppData();
  const { user, role } = useAuth();
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refreshFromBackend = useCallback(async () => {
    const current = ++generation.current;
    if (role !== 'admin') { setState(empty()); setLoading(false); return null; }
    setLoading(true); setError('');
    try {
      const res = await api.admin.getState();
      if (!res.ok || !res.state) throw new Error('Could not refresh balances.');
      if (current === generation.current) setState(res.state);
      return res.state;
    } catch (err) {
      if (current === generation.current) { setState(empty()); setError(err.message); }
      return null;
    } finally { if (current === generation.current) setLoading(false); }
  }, [role, user?.id]);
  useEffect(() => {
    refreshFromBackend();
    return () => { generation.current++; };
  }, [refreshFromBackend]);
  const run = async (fn) => {
    try {
      const res = await fn();
      if (!res.ok) return res;
      const updated = await refreshFromBackend();
      if (!updated) return { ok: false, errors: { form: 'Operation saved, but balances could not be refreshed. Reload to verify.' } };
      return res;
    } catch (err) { return { ok: false, errors: err.data?.errors || { form: err.message }, ...err.data }; }
  };
  const value = {
    ...state, state, loading, error, today: todayStr(), isLiveApi: !loading && !error,
    credits: Object.fromEntries(state.subscriptions.map(s => [s.id, s.credit ?? { allocated: null, consumed: null, adjustments: null, entitlement: null, remaining: null }])),
    daysForMonths: months => pricing.durations.find(d => d.months === months)?.days ?? months * 30,
    refreshFromBackend,
    allocate: input => run(() => api.admin.allocate(input)),
    adjust: input => run(() => api.admin.adjust(input.subscriptionId, { ...input, amount: Number(input.amount) })),
    renew: (id, opId) => run(() => api.admin.renew(id, opId)),
    cancel: (id, opId) => run(() => api.admin.cancel(id, opId)),
  };
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
export const useAdminData = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside <AdminDataProvider>');
  return ctx;
};
