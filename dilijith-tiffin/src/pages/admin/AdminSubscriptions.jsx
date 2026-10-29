import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ResponsiveTable from '../../components/admin/ResponsiveTable';
import RowButton from '../../components/admin/RowButton';
import StatusBadge from '../../components/admin/StatusBadge';
import SubscriptionDetailsDrawer from '../../components/admin/SubscriptionDetailsDrawer';
import UserDetailsDrawer from '../../components/admin/UserDetailsDrawer';
import AllocateSubscriptionModal from '../../components/admin/AllocateSubscriptionModal';
import useSubscriptionActions from '../../components/admin/useSubscriptionActions';
import { useAdminData } from '../../context/AdminDataContext';
import { durationLabel, isCancellable, isRenewable, mealsLabel, subscriptionStatus } from '../../utils/adminLogic';
import { formatDate } from '../../utils/dates';

const ALL = 'All statuses';
const STATUS_OPTIONS = [ALL, 'Active', 'Completed', 'Cancelled'];
const FROM_URL = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };

export default function AdminSubscriptions() {
  const { state, today, credits } = useAdminData();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(FROM_URL[params.get('status')] ?? ALL);
  const [subId, setSubId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [allocating, setAllocating] = useState(false);
  const { requestRenew, requestCancel, dialogs } = useSubscriptionActions();

  const all = useMemo(() => {
    const userById = Object.fromEntries(state.users.map((u) => [u.id, u]));
    return [...state.subscriptions]
      .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id))
      .map((sub) => ({ sub, user: userById[sub.userId], status: subscriptionStatus(sub, today), credit: credits[sub.id] }));
  }, [state, today, credits]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) =>
      (status === ALL || r.status === status) &&
      (!q || r.sub.id.toLowerCase().includes(q) || (r.user?.name ?? '').toLowerCase().includes(q) || (r.user?.email ?? '').toLowerCase().includes(q)));
  }, [all, query, status]);

  const columns = [
    { key: 'id', label: 'Subscription ID', primary: true, render: (r) => (
      <button className="font-semibold hover:underline" onClick={() => setSubId(r.sub.id)}>{r.sub.id}</button>) },
    { key: 'user', label: 'User', render: (r) => r.user?.name ?? 'Unknown user' },
    { key: 'duration', label: 'Duration', render: (r) => durationLabel(r.sub.durationMonths) },
    { key: 'meals', label: 'Meal types', render: (r) => mealsLabel(r.sub.mealTypes) },
    { key: 'start', label: 'Start date', render: (r) => <span className="whitespace-nowrap">{formatDate(r.sub.startDate)}</span> },
    { key: 'allocated', label: 'Allocated meals', render: (r) => (
      <>{r.credit.entitlement}{r.credit.adjustments !== 0 && <span className="block text-xs text-muted">incl. {r.credit.adjustments > 0 ? '+' : ''}{r.credit.adjustments} adjusted</span>}</>) },
    { key: 'consumed', label: 'Meals consumed', render: (r) => r.credit.consumed },
    { key: 'remaining', label: 'Meals remaining', render: (r) => <span className="font-bold">{r.credit.remaining ?? "Review required"}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: 'Actions', actions: true, render: (r) => (
      <div className="flex flex-wrap gap-2">
        <RowButton onClick={() => setSubId(r.sub.id)}>View</RowButton>
        {isRenewable(r.sub, today) && <RowButton tone="success" onClick={() => requestRenew(r.sub)}>Renew</RowButton>}
        {isCancellable(r.sub, today) && <RowButton tone="danger" onClick={() => requestCancel(r.sub)}>Cancel</RowButton>}
      </div>) },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Subscriptions</h1>
          <p className="mt-1 text-muted">Every subscription ever allocated. Cancelled and completed ones are kept for history.</p>
        </div>
        <Button onClick={() => setAllocating(true)}>Allocate subscription</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="sub-search" className="sr-only">Search subscriptions</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="sub-search" type="search" className="field pl-9" placeholder="Search by ID, user name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sm:w-56">
          <label htmlFor="sub-status" className="sr-only">Filter by status</label>
          <select id="sub-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">Showing {rows.length} of {all.length} subscriptions</p>
      <div className="mt-3">
        {rows.length ? (
          <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.sub.id} minWidth="min-w-[1180px]" caption="All subscriptions" />
        ) : (
          <EmptyState title="No subscriptions match" message="Try a different search or status."
            action={<Button variant="outline" onClick={() => { setQuery(''); setStatus(ALL); }}>Clear filters</Button>} />
        )}
      </div>

      {subId && !userId && (
        <SubscriptionDetailsDrawer subId={subId} onClose={() => setSubId(null)} onOpenUser={setUserId} onRenew={requestRenew} onCancel={requestCancel} />
      )}
      {userId && <UserDetailsDrawer userId={userId} onClose={() => setUserId(null)} />}
      {allocating && <AllocateSubscriptionModal onClose={() => setAllocating(false)} />}
      {dialogs}
    </div>
  );
}
