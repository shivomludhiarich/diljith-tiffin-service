import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, readJSON, removeKey, writeJSON } from '../utils/storage';
import { api, getToken, setToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readJSON(KEYS.auth, null));
  const [loading, setLoading] = useState(false);

  // Sync token and profile on load if token exists
  useEffect(() => {
    const existingToken = getToken();
    if (existingToken && !user) {
      api.auth.me()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            writeJSON(KEYS.auth, res.user);
          }
        })
        .catch(() => {
          setToken(null);
          removeKey(KEYS.auth);
        });
    }
  }, [user]);

  // Real authentication: Phone/Credentials Login
  const loginWithCredentials = useCallback(async (phoneOrCreds, password, countryCode = '+91') => {
    setLoading(true);
    try {
      const payload = typeof phoneOrCreds === 'object'
        ? phoneOrCreds
        : { phone: phoneOrCreds, password, countryCode };
      const res = await api.auth.login(payload);
      if (res?.token) {
        setToken(res.token);
        setUser(res.user);
        writeJSON(KEYS.auth, res.user);
      }
      return { ok: true, user: res.user };
    } catch (err) {
      return { ok: false, error: err.message, data: err.data };
    } finally {
      setLoading(false);
    }
  }, []);

  // Real authentication: Register
  const registerWithCredentials = useCallback(async (userData) => {
    setLoading(true);
    try {
      const res = await api.auth.register(userData);
      if (res?.token) {
        setToken(res.token);
        setUser(res.user);
        writeJSON(KEYS.auth, res.user);
      }
      return { ok: true, user: res.user };
    } catch (err) {
      return { ok: false, error: err.message, data: err.data };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    removeKey(KEYS.auth);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeJSON(KEYS.auth, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      role: user?.role ?? null,
      loading,
      loginWithCredentials,
      registerWithCredentials,
      logout,
      updateUser,
    }),
    [user, loading, loginWithCredentials, registerWithCredentials, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
