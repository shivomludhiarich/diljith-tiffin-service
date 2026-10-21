import { SearchX } from 'lucide-react';

export default function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <SearchX className="mb-3 h-9 w-9 text-muted" aria-hidden="true" />
      <h3 className="text-xl">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
