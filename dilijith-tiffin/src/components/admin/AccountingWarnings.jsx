import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/dates';
import { mealLabel } from '../../utils/adminLogic';
export default function AccountingWarnings({ warnings = [], catchingUp = false, refresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const check = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { setError(await refresh({ background: true }) ? '' : 'Could not refresh warnings. Displayed information may be out of date.'); }
    catch { setError('Could not refresh warnings. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) check(); }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  if (!warnings.length && !catchingUp && !error) return null;
  return <section className="mb-6 rounded-xl border border-accent bg-accent/10 p-4" aria-label="Meal accounting warnings">
    <div role="alert">
      <h2 className="text-lg font-bold">Meal accounting needs attention</h2>
      {!!warnings.length && <p>{warnings.length} meals could not be charged. No credits were deducted for these meals.</p>}
      {catchingUp && <p>Accounting is catching up. Balances and warnings may be incomplete; check again shortly.</p>}
      {error && <p>{error}</p>}
    </div>
    {!!warnings.length && <details className="mt-3">
      <summary className="cursor-pointer font-semibold">View affected meals</summary>
      <ul className="mt-2 max-h-80 space-y-3 overflow-y-auto">
        {warnings.map(w => <li key={w.id} className="rounded-lg border border-line bg-white p-3 text-sm">
          <p className="font-bold">{w.customerName} {w.phone}</p>
          <p>{mealLabel(w.mealType)} · {formatDate(w.date)}</p><p>{w.reason}</p>
          <p className="break-all text-xs">Subscription: {w.subscriptionId} · Meal: {w.id}</p>
        </li>)}
      </ul>
      <p className="mt-3 text-sm">Review the credit history before correcting it. Check again after correction; warnings clear when the meal is resolved.</p>
      <Link to="/admin/subscriptions" className="underline">Review subscriptions</Link>
    </details>}
    <button type="button" onClick={check} disabled={busy} className="mt-3 rounded-lg border bg-white px-3 py-2">{busy ? 'Checking…' : 'Check again'}</button>
  </section>;
}
