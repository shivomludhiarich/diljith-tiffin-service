import { useState, useEffect, useCallback } from 'react';
import { Phone, MapPin, AlertTriangle, Search, X, Loader2, Users, Package, Coffee, Sun, Moon } from 'lucide-react';
import Drawer from './Drawer';
import { api } from '../../services/api';
import { formatDate } from '../../utils/dates';

const MEAL_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon };
const MEAL_COLORS = { breakfast: 'text-amber', lunch: 'text-leaf', dinner: 'text-brand' };

function formatAddress(address) {
  if (!address) return null;
  const parts = [
    address.houseOrFlat,
    address.street,
    address.area,
    address.city,
    address.state,
    address.postalCode,
  ].filter(Boolean);
  return parts.join(', ');
}

function DeliveryCard({ entry, index }) {
  const addrText = formatAddress(entry.address);
  return (
    <li className={`rounded-xl border p-4 ${!entry.hasAddress ? 'border-accent/60 bg-accent/5' : 'border-line bg-white'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-leaf">
            {index + 1}
          </span>
          <span className="truncate font-bold text-ink">{entry.name}</span>
        </div>
        {entry.portions > 1 && (
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-leaf">
            ×{entry.portions}
          </span>
        )}
      </div>

      {/* Phone */}
      <a
        href={`tel:${entry.phone}`}
        className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-leaf hover:underline"
      >
        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {entry.phone}
      </a>

      {/* Address */}
      {addrText ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {addrText}
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Address missing — cannot deliver
        </p>
      )}
    </li>
  );
}

export default function DeliveryDrawer({ open, onClose, mealType, date }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    if (!mealType || !date) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.admin.getMealDeliveries(date, mealType);
      if (res?.ok) setData(res);
      else setError(res?.message || 'Failed to load deliveries.');
    } catch (err) {
      setError(err.message || 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [mealType, date]);

  useEffect(() => {
    if (open) { setSearch(''); load(); }
    else       { setData(null); setError(''); }
  }, [open, load]);

  const Icon = mealType ? MEAL_ICONS[mealType] : null;
  const iconColor = mealType ? MEAL_COLORS[mealType] : '';
  const label = mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1) : '';

  const filtered = data?.deliveries?.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.phone.includes(q);
  }) ?? [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {Icon && <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />}
          {label} deliveries
        </span>
      }
      subtitle={date ? `${formatDate(date)}` : ''}
    >
      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm">Loading delivery list…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          <p className="font-semibold">Could not load delivery list</p>
          <p className="mt-1">{error}</p>
          <button onClick={load} className="mt-3 text-xs font-bold text-danger underline">
            Try again
          </button>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-brand" aria-hidden="true" />
              <p className="mt-1 font-display text-3xl font-bold">{data.customerCount}</p>
              <p className="text-xs text-muted">Customers</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <Package className="mx-auto h-5 w-5 text-brand" aria-hidden="true" />
              <p className="mt-1 font-display text-3xl font-bold">{data.totalPortions}</p>
              <p className="text-xs text-muted">Portions</p>
            </div>
          </div>

          {/* Missing address warning */}
          {data.missingAddress > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">
                  {data.missingAddress} customer{data.missingAddress > 1 ? 's' : ''} without an address
                </p>
                <p className="mt-0.5 text-muted">
                  These meals cannot be delivered. Ask the customer to update their profile address.
                </p>
              </div>
            </div>
          )}

          {/* Search */}
          {data.customerCount > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search by name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-8 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-2 my-auto rounded p-0.5 text-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-line bg-bg2 p-8 text-center text-sm text-muted">
              {data.customerCount === 0
                ? `No ${label.toLowerCase()} deliveries scheduled for this date.`
                : 'No results match your search.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((entry, i) => (
                <DeliveryCard key={entry.userId} entry={entry} index={i} />
              ))}
            </ul>
          )}

          {/* Footer count */}
          {search && filtered.length > 0 && (
            <p className="text-center text-xs text-muted">
              Showing {filtered.length} of {data.customerCount}
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}
