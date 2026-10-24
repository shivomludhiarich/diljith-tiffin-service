import { useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import Drawer from './Drawer';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';
import AllocateSubscriptionModal from './AllocateSubscriptionModal';
import AdjustCreditsModal from './AdjustCreditsModal';
import { AdjustmentList, CreditBreakdown, Field, MealHistory, Section } from './DetailParts';
import { useAdminData } from '../../context/AdminDataContext';
import { NO_SUB, durationLabel, isLive, mealsLabel, recentMeals, subscriptionStatus, perMealCredits } from '../../utils/adminLogic';
import { formatDate } from '../../utils/dates';
import { api } from '../../services/api';

export default function UserDetailsDrawer({ userId, onClose }) {
  const { state, today, credits } = useAdminData();
  const [allocating, setAllocating] = useState(false);
  const [reference, setReference] = useState('');
  const [verified, setVerified] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  async function resetPassword() {
    setResetBusy(true);
    try { const result = await api.admin.resetCustomerPassword(userId, { reference: reference.trim(), identityVerified: verified }); setResetMessage(result.message); setReference(''); setVerified(false); }
    catch (err) { setResetMessage(err.message); }
    finally { setResetBusy(false); }
  }
  // adjusting: null | subscriptionId
  const [adjusting, setAdjusting] = useState(null);

  const user = state.users.find((u) => u.id === userId);
  if (!user) return null;

  // All of this user's subscriptions, newest first
  const subs = state.subscriptions
    .filter((s) => s.userId === user.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // All LIVE subscriptions for this user (could be multiple for different meal types)
  const liveSubs = subs.filter((s) => isLive(subscriptionStatus(s, today)));
  const hasLive = liveSubs.length > 0;

  // Per-meal-type credit breakdown
  const mealCreditMap = perMealCredits(state, userId, today, credits);

  const adjustments = state.adjustments.filter((a) => a.userId === user.id);

  // Determine overall status label
  let overallStatusLabel = NO_SUB;
  if (hasLive) {
    const hasExpiring = liveSubs.some((s) => subscriptionStatus(s, today) === 'Expiring soon');
    overallStatusLabel = hasExpiring ? 'Expiring soon' : 'Active';
  }

  const addrParts = user.address
    ? [user.address.houseOrFlat, user.address.street, user.address.area, user.address.city, user.address.state, user.address.postalCode].filter(Boolean)
    : [];

  return (
    <>
      <Drawer open onClose={onClose} title={user.name} subtitle={`Customer since ${formatDate(user.registeredOn)}`}>
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-white p-4">
          <Field label="Email">{user.email || '—'}</Field>
          <Field label="Phone">{user.phone || '—'}</Field>
        </dl>

        <div className="rounded-xl border border-line bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <MapPin className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            Delivery Address
          </p>
          {addrParts.length > 0 ? (
            <p className="mt-1.5 text-sm font-medium text-ink">{addrParts.join(', ')}</p>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              No delivery address provided yet
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAllocating(true)}>
            {hasLive ? 'Add / replace meal allocation' : 'Allocate subscription'}
          </Button>
        </div>

        {/* Per-meal credit breakdown */}
        <Section title="Password recovery">
          <p>Verify this customer's identity through your established support process. Ask them to open /reset-password on their own device and give you their reference directly. Never approve a reference provided by someone else. No message is sent.</p>
          <label className="block mt-3">Recovery reference<input className="field" value={reference} onChange={e => setReference(e.target.value)} maxLength={64} /></label>
          <label className="block my-3"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> I verified this customer's identity and reference.</label>
          <Button disabled={resetBusy || !verified || !/^[a-f0-9]{64}$/.test(reference.trim())} onClick={resetPassword}>Reset Password</Button>
          {resetMessage && <p role="status">{resetMessage}</p>}
        </Section>
        <Section title="Credits by meal type" action={<StatusBadge status={overallStatusLabel} />}>
          {hasLive ? (
            <dl className="grid grid-cols-3 gap-3">
              {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                const mc = mealCreditMap[mealType];
                return (
                  <div key={mealType} className="rounded-xl border border-line bg-white p-3 text-center">
                    <dt className="text-xs font-semibold text-muted capitalize">{mealType}</dt>
                    {mc ? (
                      <>
                        <dd className="font-display mt-1 text-2xl font-bold text-leaf">{mc.remaining ?? "Review required"}</dd>
                        <p className="text-xs text-muted">{mc.consumed} consumed</p>
                        <p className="text-xs text-muted">{mc.entitlement} allotted</p>
                      </>
                    ) : (
                      <dd className="mt-1 text-xs text-muted">Not allocated</dd>
                    )}
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="text-sm text-muted">This user has no active subscription yet.</p>
          )}
        </Section>

        {/* Active subscriptions — each with its own adjust-credits action */}
        {liveSubs.length > 0 && (
          <Section title={`Active subscription${liveSubs.length > 1 ? 's' : ''}`}>
            <div className="space-y-3">
              {liveSubs.map((sub) => {
                const status = subscriptionStatus(sub, today);
                const credit = credits[sub.id];
                return (
                  <div key={sub.id} className="rounded-xl border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">{sub.id}</span>
                        <span className="ml-2 text-sm text-muted">{durationLabel(sub.durationMonths)} · {mealsLabel(sub.mealTypes)}</span>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatDate(sub.startDate)} – {formatDate(sub.endDate)}</p>
                    {credit && (
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <dt className="text-muted">Allotted</dt>
                          <dd className="font-bold">{credit.entitlement}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Consumed</dt>
                          <dd className="font-bold">{credit.consumed}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Remaining</dt>
                          <dd className="font-bold text-leaf">{credit.remaining ?? "Review required"}</dd>
                        </div>
                      </dl>
                    )}
                    <div className="mt-3">
                      <Button variant="outline" onClick={() => setAdjusting(sub.id)}>
                        Adjust credits
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Recent meal history"><MealHistory meals={recentMeals(state, { userId: user.id }, 10)} showSub /></Section>

        <Section title="Credit adjustments"><AdjustmentList adjustments={adjustments} /></Section>

        <Section title="Subscription history">
          {subs.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="font-semibold">{s.id}</span> · {durationLabel(s.durationMonths)} · {mealsLabel(s.mealTypes)}
                    <span className="block text-xs text-muted">{formatDate(s.startDate)} to {formatDate(s.endDate)}{s.cancelReason ? ` · ${s.cancelReason}` : ''}</span>
                  </span>
                  <StatusBadge status={subscriptionStatus(s, today)} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No subscriptions on record.</p>}
        </Section>
      </Drawer>

      {allocating && <AllocateSubscriptionModal presetUserId={user.id} onClose={() => setAllocating(false)} />}
      {adjusting && <AdjustCreditsModal subscriptionId={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  );
}
