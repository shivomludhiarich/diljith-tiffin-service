import { withinRateLimit } from '../services/authRateLimit.js';
import { normalizePhone } from '../utils/phone.js';

export const AUTH_LIMITS = {
  login: { duration: 5 * 60000, ip: 50, account: 10 },
  register: { duration: 15 * 60000, ip: 20, account: 5 },
};

export function authThrottle(action) {
  const policy = AUTH_LIMITS[action];
  return async (req, res, next) => {
    const reject = () => res.status(429).set('Retry-After', String(Math.max(1, Math.ceil((policy.duration - Date.now() % policy.duration) / 1000))))
      .json({ ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' });
    try {
      // Use Express's trusted IP, never arbitrary client-supplied forwarding headers.
      if (!await withinRateLimit(`${action}-ip:${req.ip}`, policy.duration, policy.ip)) return reject();
      const raw = req.body?.phone || req.body?.identifier || req.body?.email;
      if (typeof raw !== 'string' || raw.length > 254) return res.status(400).json({ ok: false, message: 'Enter a valid account identifier.' });
      const countryCode = typeof req.body?.countryCode === 'string' ? req.body.countryCode : '+91';
      const identifier = raw.includes('@') ? raw.trim().toLowerCase() : normalizePhone(raw, countryCode);
      if (!await withinRateLimit(`${action}-account:${identifier}`, policy.duration, policy.account)) return reject();
      next();
    } catch {
      // Do not silently disable protection when its database is unavailable.
      res.status(503).json({ ok: false, message: 'Sign-in services are temporarily unavailable. Please try again later.' });
    }
  };
}
