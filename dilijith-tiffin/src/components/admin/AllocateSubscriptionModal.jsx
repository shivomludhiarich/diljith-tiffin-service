import { useRef, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';
import { useAdminData } from '../../context/AdminDataContext';
import { useAppData } from '../../context/AppDataContext';
import { useToast } from '../../context/ToastContext';
import {
  DURATIONS, defaultEntitlement, durationLabel, mealLabel, mealsLabel, subscriptionStatus, uid,
} from '../../utils/adminLogic';
import { MEAL_KEYS, calculatePlan, formatINR } from '../../utils/pricing';

const Err = ({ id, children }) => (children ? <p id={id} role="alert" className="mt-1 text-sm text-danger">{children}</p> : null);

/** Mount this only while it should be open, so the form starts fresh every time. */
export default function AllocateSubscriptionModal({ presetUserId = '', onClose }) {
  const { state, users, today, credits, allocate, daysForMonths, refreshFromBackend } = useAdminData();
  const { pricing } = useAppData();
  const { notify } = useToast();
  const opId = useRef(uid('op')); // same id on every submit attempt of this form instance => no duplicates
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [mealsTouched, setMealsTouched] = useState(false);
  const [conflicts, setConflicts] = useState(null); // [{ sub, overlappingMeals }] when needsConfirm
  const [form, setForm] = useState({ userId: presetUserId, durationMonths: 1, mealTypes: ['lunch'], startDate: today, allocatedMeals: '' });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const suggested = defaultEntitlement(form.durationMonths, form.mealTypes, daysForMonths);
  const allocatedMeals = mealsTouched ? form.allocatedMeals : String(suggested || '');

  const customers = users.filter((u) => u.role !== 'admin');

  const durationCfg = pricing.durations.find((d) => d.months === form.durationMonths);
  const plan = durationCfg ? calculatePlan(pricing, durationCfg.id, form.mealTypes) : null;

  const toggleMeal = (key) => {
    set({ mealTypes: [key] });
    // Reset any conflict state when meal selection changes
    setConflicts(null);
    setConfirmReplace(false);
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!String(allocatedMeals).trim()) { setErrors({ allocatedMeals: 'Enter an explicit credit quantity.' }); return; }
    setBusy(true);
    try {
      const result = await allocate({
        ...form, mealAllocations: { [form.mealTypes[0]]: Number(allocatedMeals) }, confirmReplace, demoPrice: plan?.total ?? null, opId: opId.current,
      });
      if (result.ok) {
        const targetUser = customers.find((u) => u.id === form.userId);
        const userName = targetUser?.name || result.user?.name || 'Customer';
        const subId = result.subscription?.id || result.subscription?.subCode || 'Subscription';
        notify(`${subId} allocated to ${userName}.`);
        onClose();
        return;
      }
      if (result.needsConfirm) {
        setConflicts(result.conflicts ?? null);
        setErrors({});
      } else {
        setConflicts(null);
        setErrors(result.errors || { form: result.message || 'Allocation could not be saved.' });
      }
    } catch (err) {
      setErrors({ form: err.message || 'Failed to allocate subscription.' });
    } finally {
      setBusy(false);
    }
  };

  // Derive which selected meal types already have an active subscription (for display)
  const conflictingMealTypes = conflicts ? [...new Set(conflicts.flatMap((c) => c.overlappingMeals))] : [];
  const conflictSubIds = conflicts ? [...new Set(conflicts.map((c) => c.sub.id))] : [];

  return (
    <Modal open onClose={onClose} title="Allocate subscription" maxWidth="max-w-xl">
      <form onSubmit={submit} noValidate className="space-y-5">
        {errors.form && <p role="alert" className="rounded-lg border border-danger/50 bg-white px-3 py-2 text-sm text-danger">{errors.form}</p>}

        <div>
          <label htmlFor="alloc-user" className="mb-1 block text-sm font-semibold">User</label>
          <select id="alloc-user" className="field" value={form.userId} aria-describedby="alloc-user-err"
            onChange={(e) => { set({ userId: e.target.value }); setConfirmReplace(false); setConflicts(null); setErrors({}); }}>
            <option value="">Select a user</option>
            {customers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.phone ? u.phone : u.email || 'No contact'})
              </option>
            ))}
          </select>
          <Err id="alloc-user-err">{errors.userId}</Err>
        </div>

        {/* Conflict warning — only shown when the selected meal types overlap with existing active allocations */}
        {conflicts && (
          <div className="rounded-lg border border-accent bg-white p-4 text-sm">
            <p className="font-bold text-amber">
              {conflictingMealTypes.map(mealLabel).join(' & ')} {conflictingMealTypes.length === 1 ? 'is' : 'are'} already allocated
            </p>
            <p className="mt-1 text-muted">
              The following active subscription{conflictSubIds.length > 1 ? 's' : ''} already cover{conflictSubIds.length === 1 ? 's' : ''}
              {' '}<strong>{conflictingMealTypes.map(mealLabel).join(' and ')}</strong> for this user:
            </p>
            <ul className="mt-2 space-y-1">
              {conflicts.map(({ sub, overlappingMeals }) => (
                <li key={sub.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{sub.id}</span>
                  <StatusBadge status={subscriptionStatus(sub, today)} />
                  <span className="text-muted">{mealsLabel(sub.mealTypes)} · valid until credits are used</span>
                  <span className="text-muted">· {credits[sub.id]?.remaining ?? 0} meals remaining</span>
                  <span className="font-medium text-amber">conflicts: {overlappingMeals.map(mealLabel).join(', ')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-muted">
              Subscriptions for <strong>different meal types</strong> that this user holds will not be affected.
            </p>
            <label className="mt-3 flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
              <span>
                Replace the conflicting subscription{conflictSubIds.length > 1 ? 's' : ''} ({conflictSubIds.join(', ')}).
                All meal types and unused credits on these subscriptions will become unavailable. Their future meals will be cancelled and their history kept.
                All other active meal allocations remain untouched.
              </span>
            </label>
          </div>
        )}

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Credit package</legend>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((m) => (
              <label key={m} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold ${form.durationMonths === m ? 'border-brand bg-white ring-1 ring-brand' : 'border-line bg-bg2'}`}>
                <input type="radio" name="duration" className="sr-only" checked={form.durationMonths === m} onChange={() => set({ durationMonths: m })} />
                {durationLabel(m)}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Package size sets the suggested number of credits, not an expiry date.</p>
          <Err>{errors.durationMonths}</Err>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Meal type (one per allocation)</legend>
          <div className="grid grid-cols-3 gap-2">
            {MEAL_KEYS.map((k) => {
              const on = form.mealTypes.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => toggleMeal(k)}
                  className={`h-11 rounded-lg border text-sm font-bold ${on ? 'border-brand bg-white ring-1 ring-brand' : 'border-line bg-bg2'}`}>
                  {mealLabel(k)}
                </button>
              );
            })}
          </div>
          <Err>{errors.mealTypes}</Err>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="alloc-start" className="mb-1 block text-sm font-semibold">Start date</label>
            <input id="alloc-start" type="date" className="field" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            <Err>{errors.startDate}</Err>
            <p className="mt-1 text-xs text-muted">Valid until all meal credits are used</p>
          </div>
          <div>
            <label htmlFor="alloc-meals" className="mb-1 block text-sm font-semibold">{mealLabel(form.mealTypes[0])} credits</label>
            <input id="alloc-meals" type="number" min="0" step="1" inputMode="numeric" className="field" value={allocatedMeals}
              onChange={(e) => { setMealsTouched(true); set({ allocatedMeals: e.target.value }); }} />
            <Err>{errors.allocatedMeals}</Err>
            <p className="mt-1 text-xs text-muted">Suggested: {suggested} ({daysForMonths(form.durationMonths)} days x {form.mealTypes.length} meal{form.mealTypes.length === 1 ? '' : 's'})</p>
          </div>
        </div>

        <p className="rounded-lg bg-bg2 px-3 py-2 text-sm">
          Price: <strong>{plan ? `${formatINR(plan.total)} (demo price)` : 'Not configured (placeholder)'}</strong>
          <span className="block text-xs text-muted">Taken from the demo pricing configuration. Not a confirmed business rate.</span>
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || (conflicts && !confirmReplace)}>
            {conflicts ? 'Replace conflicting & allocate' : 'Allocate subscription'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
