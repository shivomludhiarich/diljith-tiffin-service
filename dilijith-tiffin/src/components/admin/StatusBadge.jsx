const STYLES = {
  Active: 'border-brand/60 text-leaf',
  'Expiring soon': 'border-accent text-amber',
  Expired: 'border-line text-muted',
  Cancelled: 'border-danger/50 text-danger',
  'No subscription': 'border-line text-muted',
  Scheduled: 'border-ink/25 text-ink',
  Consumed: 'border-brand/60 text-leaf',
  Missed: 'border-accent text-amber',
  'Not Included': 'border-line text-muted',
  'Not scheduled': 'border-line text-muted',
};

export default function StatusBadge({ status }) {
  if (status === 'Scheduled') return null;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border bg-white px-2.5 py-0.5 text-xs font-bold ${STYLES[status] ?? STYLES.Expired}`}>
      {status}
    </span>
  );
}
