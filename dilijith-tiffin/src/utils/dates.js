// Date helpers. Dates are stored as local "YYYY-MM-DD" strings so there are no timezone surprises.
const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toDateStr(parseDate(s)) === s;

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Adds calendar months, clamping to the last day of shorter months (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s, n) {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateStr(d);
}

/** Inclusive last day of a plan: 15 Oct + 1 month ends on 14 Nov. */
export const endDateFor = (start, months) => addDays(addMonths(start, months), -1);

/** Whole days from b to a (a - b). */
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);

export const formatDate = (s) =>
  s ? parseDate(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
