import { useRef, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../../context/ToastContext';
import { isLive, subscriptionStatus, uid, validateAdjustment } from '../../utils/adminLogic';

const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'border-t border-line pt-2 font-bold' : ''}`}>
    <dt className="text-muted">{label}</dt><dd>{value}</dd>
  </div>
);

/**
 * Adjust credits for a specific subscription (identified by subscriptionId).
 * Must target a specific subscription so that credit adjustments never bleed across meal types.
 */
export default function AdjustCreditsModal({ subscriptionId, onClose }) {
  const { state, today, credits, adjust } = useAdminData();
  const { notify } = useToast();
  const opId = useRef(uid('op'));
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState('form');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  const user = sub ? state.users.find((u) => u.id === sub.userId) : null;

  if (!sub || !user || !isLive(subscriptionStatus(sub, today))) {
    return (
      <Modal open onClose={onClose} title="Adjust meal credits">
        <p className="text-sm text-muted">This subscription is not active, so there is nothing to adjust.</p>
        <div className="mt-5 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </Modal>
    );
  }

  const c = credits[sub.id];
  const checked = validateAdjustment(c, { amount, reason });
  const n = checked.amount;
  const preview = !checked.errors.amount ? { entitlement: c.entitlement + n, remaining: c.remaining + n } : null;

  const review = (e) => {
    e.preventDefault();
    setErrors(checked.errors);
    if (!Object.keys(checked.errors).length) setStep('confirm');
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await adjust({ subscriptionId: sub.id, amount, reason, opId: opId.current });
      if (result.ok) {
        notify(`${n > 0 ? '+' : ''}${n} meal credits applied to ${sub.id} (${user.name}).`);
        onClose();
        return;
      }
      setErrors(result.errors || {});
      setStep('form');
    } catch (err) {
      setErrors({ form: err.message || 'Failed to adjust credits.' });
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Adjust meal credits">
      <p className="mb-1 text-sm font-semibold">{user.name} · {sub.id}</p>
      <p className="mb-4 text-xs text-muted">Meal types: {sub.mealTypes.join(', ')} · expires {sub.endDate}</p>
      <dl className="rounded-lg bg-white p-4 text-sm">
        <Row label="Current entitlement" value={`${c.entitlement} meals`} />
        <Row label="Meals consumed" value={c.consumed} />
        <Row label="Current remaining balance" value={`${c.remaining} meals`} strong />
      </dl>

      {step === 'form' ? (
        <form onSubmit={review} noValidate className="mt-5 space-y-4">
          {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
          <div>
            <label htmlFor="adj-amount" className="mb-1 block text-sm font-semibold">Credits to add</label>
            <input id="adj-amount" inputMode="numeric" autoComplete="off" className="field" placeholder="e.g. 10" value={amount}
              onChange={(e) => setAmount(e.target.value)} aria-describedby="adj-amount-help" />
            <p id="adj-amount-help" className="mt-1 text-xs text-muted">Whole numbers only. Use a negative number for an administrative correction.</p>
            {errors.amount && <p role="alert" className="mt-1 text-sm text-danger">{errors.amount}</p>}
          </div>
          <div>
            <label htmlFor="adj-reason" className="mb-1 block text-sm font-semibold">Reason (required)</label>
            <textarea id="adj-reason" rows={3} maxLength={200} className="field h-auto py-2" value={reason} onChange={(e) => setReason(e.target.value)} />
            {errors.reason && <p role="alert" className="mt-1 text-sm text-danger">{errors.reason}</p>}
          </div>
          {preview && (
            <p className="rounded-lg bg-bg2 px-3 py-2 text-sm">
              New entitlement <strong>{preview.entitlement}</strong> · new remaining balance <strong>{preview.remaining}</strong>
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Review adjustment</Button>
          </div>
        </form>
      ) : (
        <div className="mt-5">
          <p className="text-sm">
            Add <strong>{n > 0 ? `+${n}` : n}</strong> meal credits for <strong>{user.name}</strong> on subscription <strong>{sub.id}</strong>?
            Entitlement becomes <strong>{preview.entitlement}</strong> and the remaining balance <strong>{preview.remaining}</strong>.
          </p>
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-muted">Reason: {checked.reason}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
            <Button onClick={apply} disabled={busy}>Confirm adjustment</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
