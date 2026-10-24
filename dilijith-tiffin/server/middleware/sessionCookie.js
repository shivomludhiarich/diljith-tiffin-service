export const SESSION_COOKIE = '__Host-dts-session';
export const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };
export const setSessionCookie = (res, token) => res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 7 * 86400000 });
export const clearSessionCookie = res => res.clearCookie(SESSION_COOKIE, cookieOptions);
export function readSessionCookie(req) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  return value ? decodeURIComponent(value.slice(SESSION_COOKIE.length + 1)) : null;
}
export function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = new Set(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000']);
  if (process.env.ALLOWED_ORIGIN) allowed.add(process.env.ALLOWED_ORIGIN);
  if (!allowed.has(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ ok: false, message: 'Untrusted request origin.' });
  next();
}
