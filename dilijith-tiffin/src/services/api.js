const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(endpoint, options = {}) {

  const headers = {
    'Content-Type': 'application/json',

    ...(options.headers || {}),
  };

  const url = `${API_BASE}${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers, credentials: 'include' });
    const data = await res.json().catch(() => { throw new Error('The server returned an unexpected response. Please try again later.'); });
    if (!res.ok) {
      const error = new Error(data.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netErr = new Error('Cannot reach the service. Please check your connection and try again.');
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
    logout: () => request('/auth/logout', { method: 'POST' }),
    resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    login: (phoneOrCreds, password, countryCode = '+91') => {
      const body = typeof phoneOrCreds === 'object'
        ? phoneOrCreds
        : { phone: phoneOrCreds, password, countryCode };
      return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    },
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    me: () => request('/auth/me'),
  },

  admin: {
    resetCustomerPassword: (id, data) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),
    getState:    () => request('/admin/state'),
    getDashboard: () => request('/admin/dashboard'),
    getUsers:    (search) => request(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    createUser:  (data) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    allocate:    (input) => request('/admin/subscriptions/allocate', { method: 'POST', body: JSON.stringify(input) }),
    adjust:      (id, input) => request(`/admin/subscriptions/${id}/adjust`, { method: 'POST', body: JSON.stringify(input) }),
    renew:       (id, opId) => request(`/admin/subscriptions/${id}/renew`, { method: 'POST', body: JSON.stringify({ opId }) }),
    cancel:      (id, opId) => request(`/admin/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ opId }) }),
    consume: (id, opId) => request(`/admin/meals/${id}/consume`, { method: 'POST', body: JSON.stringify({ opId }) }),
    // Delivery workflow
    getMealSummary:    (date) => request(`/admin/meals/summary?date=${date}`),
    getMealDeliveries: (date, mealType) => request(`/admin/meals/deliveries?date=${date}&mealType=${mealType}`),
  },

  user: {
    getDashboard:   () => request('/user/dashboard'),
    getTodaysMeals: () => request('/user/meals/today'),
    getRecentMeals: (limit = 8) => request(`/user/meals/recent?limit=${limit}`),
    cancelMeal:     (recordId, opId) => request(`/user/meals/${recordId}/cancel`, { method: 'POST', body: JSON.stringify({ opId }) }),
    updateAddress:  (address) => request('/user/me/address', { method: 'PATCH', body: JSON.stringify({ address }) }),
    getMe:          () => request('/user/me'),
  },
};
