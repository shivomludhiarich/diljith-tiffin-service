import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, AlertTriangle } from 'lucide-react';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ResponsiveTable from '../../components/admin/ResponsiveTable';
import RowButton from '../../components/admin/RowButton';
import StatusBadge from '../../components/admin/StatusBadge';
import UserDetailsDrawer from '../../components/admin/UserDetailsDrawer';
import AllocateSubscriptionModal from '../../components/admin/AllocateSubscriptionModal';
import { useAdminData } from '../../context/AdminDataContext';
import { NO_SUB, durationLabel, mealsLabel, userRows } from '../../utils/adminLogic';

const STATUS_OPTIONS = ['All statuses', 'Active', 'Expiring soon', 'Expired', 'Cancelled', NO_SUB, 'Missing address'];

export default function AdminUsers() {
  const { state, today, credits, refreshFromBackend } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  
  const initialFilter = searchParams.get('filter') === 'missing_address' ? 'Missing address' : STATUS_OPTIONS[0];
  const [status, setStatus] = useState(initialFilter);
  const [detailsId, setDetailsId] = useState(null);
  const [allocate, setAllocate] = useState(null); // null = closed, '' = no preset user, 'u1' = preset user

  useEffect(() => {
    if (searchParams.get('filter') === 'missing_address') {
      setStatus('Missing address');
    }
  }, [searchParams]);

  useState(() => {
    if (refreshFromBackend) refreshFromBackend();
  });

  const all = useMemo(() => userRows(state, today, credits), [state, today, credits]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      const matchesStatus =
        status === STATUS_OPTIONS[0]
          ? true
          : status === 'Missing address'
          ? !r.user.hasAddress
          : r.status === status;

      const matchesQuery =
        !q ||
        r.user.name?.toLowerCase().includes(q) ||
        (r.user.email && r.user.email.toLowerCase().includes(q)) ||
        (r.user.phone && r.user.phone.includes(q));

      return matchesStatus && matchesQuery;
    });
  }, [all, query, status]);

  const clear = () => {
    setQuery('');
    setStatus(STATUS_OPTIONS[0]);
    if (searchParams.get('filter')) {
      searchParams.delete('filter');
      setSearchParams(searchParams);
    }
  };

  const columns = [
    { key: 'name', label: 'User name', primary: true, render: (r) => (
      <button className="text-left font-semibold hover:underline" onClick={() => setDetailsId(r.user.id)}>{r.user.name}</button>) },
    { key: 'email', label: 'Email', render: (r) => <span className="break-all">{r.user.email || '-'}</span> },
    { key: 'phone', label: 'Phone', render: (r) => r.user.phone || '-' },
    { key: 'plan', label: 'Subscription plan', render: (r) => (r.sub ? `${durationLabel(r.sub.durationMonths)} (${r.sub.id})` : '-') },
    { key: 'meals', label: 'Active meal types', render: (r) => (r.sub ? mealsLabel(r.sub.mealTypes) : '-') },
    { key: 'remaining', label: 'Meals remaining', render: (r) => (r.credits ? <span className="font-bold">{r.credits.remaining}</span> : '-') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'address', label: 'Address', render: (r) => (
      r.user.hasAddress
        ? <span className="flex items-center gap-1 text-xs text-leaf font-semibold"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Saved</span>
        : <span className="flex items-center gap-1 text-xs text-amber font-semibold"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Missing</span>
    ) },
    { key: 'actions', label: 'Actions', actions: true, render: (r) => (
      <div className="flex flex-wrap gap-2">
        <RowButton onClick={() => setDetailsId(r.user.id)}>View details</RowButton>
        <RowButton tone="success" onClick={() => setAllocate(r.user.id)}>{r.status === 'Active' || r.status === 'Expiring soon' ? 'Modify plan' : 'Allocate plan'}</RowButton>
      </div>) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Users</h1>
          <p className="mt-1 text-muted">Find customers, check their balance and manage their subscription.</p>
        </div>
        <Button onClick={() => setAllocate('')}>Allocate subscription</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="user-search" className="sr-only">Search users by name or email</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="user-search" type="search" className="field pl-9" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sm:w-56">
          <label htmlFor="user-status" className="sr-only">Filter by subscription status</label>
          <select id="user-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">Showing {rows.length} of {all.length} users</p>
      <div className="mt-3">
        {rows.length ? (
          <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.user.id} minWidth="min-w-[980px]" caption="Users and their subscriptions" />
        ) : (
          <EmptyState title="No users match" message="Try a different name, email or status." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
        )}
      </div>

      {detailsId && <UserDetailsDrawer userId={detailsId} onClose={() => setDetailsId(null)} />}
      {allocate !== null && <AllocateSubscriptionModal presetUserId={allocate} onClose={() => setAllocate(null)} />}
    </div>
  );
}
