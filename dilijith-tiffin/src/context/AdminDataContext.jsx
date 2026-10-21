import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from './AppDataContext';
import { useAuth } from './AuthContext';
import { createSeed } from '../data/adminSeed';
import { readJSON, writeJSON } from '../utils/storage';
import { todayStr } from '../utils/dates';
import {
  adjustCredits, allocateSubscription, cancelSubscription, creditMap, isValidAdminState, renewSubscription,
} from '../utils/adminLogic';
import { cancelMeal } from '../utils/userLogic';
import { api, getToken, setToken } from '../services/api';

const KEY = 'dts.admin';
const AdminDataContext = createContext(null);

export function AdminDataProvider({ children }) {
  const { pricing } = useAppData();
  const { user, role } = useAuth();
  const [state, setState] = useState(() => {
    const stored = readJSON(KEY, null);
    return isValidAdminState(stored) ? stored : createSeed();
  });
  const [isLiveApi, setIsLiveApi] = useState(false);
  const latest = useRef(state);
  const handled = useRef(new Set());

  // Keep latest ref in sync and persist locally
  useEffect(() => {
    latest.current = state;
    writeJSON(KEY, state);
  }, [state]);

  // Fetch real state from MongoDB backend
  const refreshFromBackend = useCallback(async () => {
    try {
      // If user is admin but has no token yet, request demo admin token so backend accepts query
      let token = getToken();
      if (!token && role === 'admin') {
        const demoRes = await api.auth.demo('admin').catch(() => null);
        if (demoRes?.token) {
          setToken(demoRes.token);
          token = demoRes.token;
        }
      }

      const res = await api.admin.getState();
      if (res?.ok && res.state && isValidAdminState(res.state)) {
        latest.current = res.state;
        setState(res.state);
        setIsLiveApi(true);
        return res.state;
      }
    } catch {
      // Backend not running or token not authorized yet
      setIsLiveApi(false);
    }
    return null;
  }, [role]);

  // Re-fetch whenever role or authenticated user changes
  useEffect(() => {
    refreshFromBackend();
  }, [role, user, refreshFromBackend]);

  // Tab synchronization
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (isValidAdminState(next)) {
          latest.current = next;
          setState(next);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const daysForMonths = useCallback(
    (months) => pricing.durations.find((d) => d.months === months)?.days ?? months * 30,
    [pricing]
  );

  // Command runner: attempts backend API call first, then updates local state
  const run = useCallback(async (command, input, opId) => {
    if (opId && handled.current.has(opId)) {
      return { ok: false, duplicate: true, errors: { form: 'This request was already submitted.' } };
    }

    // 1. Try backend API operation
    try {
      if (command === allocateSubscription) {
        const res = await api.admin.allocate(input);
        if (!res.ok) return res;
        await refreshFromBackend();
        if (opId) handled.current.add(opId);
        return { ok: true, state: latest.current, subscription: res.subscription };
      } else if (command === adjustCredits) {
        const res = await api.admin.adjust(input.subscriptionId, input);
        if (!res.ok) return res;
        await refreshFromBackend();
        if (opId) handled.current.add(opId);
        return { ok: true, state: latest.current, subscription: res.subscription };
      } else if (command === renewSubscription) {
        const res = await api.admin.renew(input);
        if (!res.ok) return res;
        await refreshFromBackend();
        if (opId) handled.current.add(opId);
        return { ok: true, state: latest.current, subscription: res.subscription };
      } else if (command === cancelSubscription) {
        const res = await api.admin.cancel(input);
        if (!res.ok) return res;
        await refreshFromBackend();
        if (opId) handled.current.add(opId);
        return { ok: true, state: latest.current, subscription: res.subscription };
      } else if (command === cancelMeal) {
        const res = await api.user.cancelMeal(input.recordId);
        if (!res.ok) return res;
        await refreshFromBackend();
        if (opId) handled.current.add(opId);
        return { ok: true, state: latest.current };
      }
    } catch (err) {
      if (err.data && err.data.errors) {
        return { ok: false, errors: err.data.errors, needsConfirm: err.data.needsConfirm, conflicts: err.data.conflicts };
      }
      if (err.data && err.data.message) {
        return { ok: false, errors: { form: err.data.message } };
      }
    }

    // Fallback: Pure local execution
    const result = command(latest.current, input, { today: todayStr(), nowIso: new Date().toISOString(), daysForMonths });
    if (result.ok) {
      latest.current = result.state;
      setState(result.state);
      if (opId) handled.current.add(opId);
    }
    return result;
  }, [daysForMonths, refreshFromBackend]);

  const value = useMemo(() => ({
    ...state,
    state,
    today: todayStr(),
    credits: creditMap(state),
    daysForMonths,
    isLiveApi,
    refreshFromBackend,
    allocate: (input) => run(allocateSubscription, input, input.opId),
    adjust: (input) => run(adjustCredits, input, input.opId),
    renew: (subId, opId) => run(renewSubscription, subId, opId),
    cancel: (subId, opId) => run(cancelSubscription, subId, opId),
    cancelMeal: (userId, recordId, opId) => run(cancelMeal, { userId, recordId }, opId),
    reset: () => {
      const seed = createSeed();
      latest.current = seed;
      handled.current.clear();
      setState(seed);
    },
  }), [state, run, daysForMonths, isLiveApi, refreshFromBackend]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export const useAdminData = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside <AdminDataProvider>');
  return ctx;
};
