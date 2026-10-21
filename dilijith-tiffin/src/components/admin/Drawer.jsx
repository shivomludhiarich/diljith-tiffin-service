import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Right-hand slide-over panel. Full width on phones. */
export default function Drawer({ open, onClose, title, subtitle, children }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50" onMouseDown={() => closeRef.current()}>
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-bg"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={() => closeRef.current()} aria-label="Close details" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 p-5">{children}</div>
      </aside>
    </div>
  );
}
