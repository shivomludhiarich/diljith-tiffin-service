// Safe localStorage wrapper. Swap these for API calls when a backend exists.
export const KEYS = {
  auth: 'dts.auth',
  menu: 'dts.menu',
  pricing: 'dts.pricing',
  selection: 'dts.selection',
  subscription: 'dts.subscription',
};

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // missing or malformed data
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working in memory */
  }
}

export function removeKey(key) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}
