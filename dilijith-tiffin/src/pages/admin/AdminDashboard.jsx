import { useState, useCallback, useEffect } from 'react';
import { Coffee, Moon, Sun, History, ChevronRight, CalendarDays, Loader2, RefreshCw } from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import DeliveryDrawer from '../../components/admin/DeliveryDrawer';
import EmptyState from '../../components/common/EmptyState';
import { useAdminData } from '../../context/AdminDataContext';
import { recentActivity } from '../../utils/adminLogic';
import { formatDate, formatDateTime, todayStr } from '../../utils/dates';
import { api } from '../../services/api';

// ---------------------------------------------------------------------------
// Meal row config
// ---------------------------------------------------------------------------
const MEAL_ROWS = [
  { key: 'breakfast', label: 'Breakfasts',  icon: Coffee, iconColor: 'text-amber' },
  { key: 'lunch',     label: 'Lunches',     icon: Sun,    iconColor: 'text-leaf'  },
  { key: 'dinner',    label: 'Dinners',     icon: Moon,   iconColor: 'text-brand' },
];

// ---------------------------------------------------------------------------
// Clickable prep card
// ---------------------------------------------------------------------------
function PrepCard({ mealKey, label, icon: Icon, iconColor, count, onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-xl border border-line bg-white p-5 text-left transition-all hover:border-brand/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
      aria-label={`View ${label} delivery list: ${count} scheduled`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">{label} to prepare</p>
          <p className="text-xs text-muted">Click to see delivery list</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
        ) : (
          <span className="font-display text-4xl font-bold text-ink">{count ?? '—'}</span>
        )}
        <ChevronRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminDashboard() {
  const { state } = useAdminData();
  const activity = recentActivity(state, 8);

  // Selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Meal summary (counts from backend for the selected date)
  const [summary, setSummary]         = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Dashboard metrics (totalUsers, activeSubscriptions, etc.)
  const [metrics, setMetrics]         = useState(null);

  // Delivery drawer
  const [drawer, setDrawer]   = useState({ open: false, mealType: null });

  // Load metrics (for stat cards – always today)
  const loadMetrics = useCallback(async () => {
    try {
      const res = await api.admin.getDashboard();
      if (res?.ok) setMetrics(res.metrics);
    } catch { /* use cached state */ }
  }, []);

  // Load meal summary for the selected date
  const loadSummary = useCallback(async (date) => {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await api.admin.getMealSummary(date);
      if (res?.ok) setSummary(res.prep);
    } catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);
  useEffect(() => { loadSummary(selectedDate); }, [selectedDate, loadSummary]);

  // Fallback counts from local state when API hasn't responded yet
  const getCount = (key) => {
    if (summary) return summary[key] ?? 0;
    if (selectedDate === todayStr() && metrics?.prep) return metrics.prep[key] ?? 0;
    return null;
  };

  const openDrawer  = (mealType) => setDrawer({ open: true, mealType });
  const closeDrawer = ()         => setDrawer({ open: false, mealType: null });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-muted">Delivery operations overview.</p>
        </div>
        <button
          onClick={() => { loadMetrics(); loadSummary(selectedDate); }}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-muted transition hover:border-ink/30 hover:text-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total users"            value={metrics?.totalUsers            ?? state.users.filter(u => u.role !== 'admin').length} to="/admin/users" />
        <StatCard label="Active subscriptions"   value={metrics?.activeSubscriptions   ?? '—'} tone="green" to="/admin/subscriptions?status=active"
          hint={metrics ? `${metrics.expiringSoon} expiring soon` : ''} />
        <StatCard label="Meals scheduled today"  value={metrics?.mealsToday            ?? '—'} hint="Excludes cancelled" />
        <StatCard label="Meals cancelled today"  value={metrics?.mealsCancelledToday   ?? '—'} />
        <StatCard label="Missing addresses"      value={metrics?.usersWithoutAddress   ?? '—'} tone="orange"
          hint="Users who need to add an address" to="/admin/users?filter=missing_address" />
      </div>

      {/* Main content */}
      <div className="mt-8 grid gap-6 lg:grid-cols-5">

        {/* ── Meal prep + date picker ── */}
        <section aria-labelledby="prep-title" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="prep-title" className="text-2xl">Daily meal summary</h2>
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <label htmlFor="delivery-date" className="text-sm font-semibold text-muted shrink-0">
              Date
            </label>
            <input
              id="delivery-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold text-ink focus:outline-none"
            />
            {selectedDate !== todayStr() && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand/10"
              >
                Today
              </button>
            )}
          </div>

          {/* Clickable prep rows */}
          <div className="space-y-3">
            {MEAL_ROWS.map(({ key, label, icon, iconColor }) => (
              <PrepCard
                key={key}
                mealKey={key}
                label={label}
                icon={icon}
                iconColor={iconColor}
                count={getCount(key)}
                loading={summaryLoading}
                onClick={() => openDrawer(key)}
              />
            ))}
          </div>

          <p className="text-xs text-muted">
            {selectedDate === todayStr()
              ? `Showing scheduled meals for today, ${formatDate(selectedDate)}.`
              : `Showing scheduled meals for ${formatDate(selectedDate)}.`}
            {' '}Click any row to see the delivery list.
          </p>
        </section>

        {/* ── Recent activity ── */}
        <section aria-labelledby="activity-title" className="lg:col-span-3">
          <h2 id="activity-title" className="mb-3 text-2xl">Recent activity</h2>
          {activity.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <History className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-bold">{a.userName}</span> · {a.label}</p>
                    <p className="break-words text-sm text-muted">{a.detail}</p>
                  </div>
                  <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted">
                    {formatDateTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No activity yet"
              message="Allocations, renewals, cancellations and credit changes will appear here."
            />
          )}
        </section>
      </div>

      {/* Delivery drawer */}
      <DeliveryDrawer
        open={drawer.open}
        onClose={closeDrawer}
        mealType={drawer.mealType}
        date={selectedDate}
      />
    </div>
  );
}
