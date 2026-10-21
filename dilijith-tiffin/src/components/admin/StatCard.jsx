import { Link } from 'react-router-dom';

const VALUE_TONE = { default: 'text-ink', green: 'text-leaf', orange: 'text-amber' };

export default function StatCard({ label, value, hint, to, tone = 'default' }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-1 font-display text-4xl font-bold ${VALUE_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-line bg-white p-5';
  return to ? <Link to={to} className={`${cls} transition-colors hover:border-ink/40`}>{body}</Link> : <div className={cls}>{body}</div>;
}
