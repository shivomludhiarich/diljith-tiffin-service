const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'dts.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${API_BASE}${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netErr = new Error('Backend server is not reachable. Ensure the Express server is running on port 5000.');
      netErr.isNetworkError = true;
      throw netErr;
    }
    throw err;
  }
}

export const api = {
  health: {
    check: () => request('/health'),
  },

  auth: {
    login: (phoneOrCreds, password, countryCode = '+91') => {
      const body = typeof phoneOrCreds === 'object'
        ? phoneOrCreds
        : { phone: phoneOrCreds, password, countryCode };
      return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    },
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    demo: (role, email, phone) => request('/auth/demo', { method: 'POST', body: JSON.stringify({ role, email, phone }) }),
    me: () => request('/auth/me'),
  },

  admin: {
    getState:    () => request('/admin/state'),
    getDashboard: () => request('/admin/dashboard'),
    getUsers:    (search) => request(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    createUser:  (data) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    allocate:    (input) => request('/admin/subscriptions/allocate', { method: 'POST', body: JSON.stringify(input) }),
    adjust:      (id, input) => request(`/admin/subscriptions/${id}/adjust`, { method: 'POST', body: JSON.stringify(input) }),
    renew:       (id) => request(`/admin/subscriptions/${id}/renew`, { method: 'POST' }),
    cancel:      (id) => request(`/admin/subscriptions/${id}/cancel`, { method: 'POST' }),
    // Delivery workflow
    getMealSummary:    (date) => request(`/admin/meals/summary?date=${date}`),
    getMealDeliveries: (date, mealType) => request(`/admin/meals/deliveries?date=${date}&mealType=${mealType}`),
  },

  user: {
    getDashboard:   () => request('/user/dashboard'),
    getTodaysMeals: () => request('/user/meals/today'),
    getRecentMeals: (limit = 8) => request(`/user/meals/recent?limit=${limit}`),
    cancelMeal:     (recordId) => request(`/user/meals/${recordId}/cancel`, { method: 'POST' }),
    updateAddress:  (address) => request('/user/me/address', { method: 'PATCH', body: JSON.stringify({ address }) }),
    getMe:          () => request('/user/me'),
  },
};
