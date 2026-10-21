import { useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../../context/ToastContext';
import { durationLabel, mealsLabel, previewRenewal, uid } from '../../utils/adminLogic';
import { formatDate } from '../../utils/dates';

/** Shared renew / cancel flow (with confirmation) for the table rows and the details drawer. */
export default function useSubscriptionActions() {
  const { users, today, renew, cancel, daysForMonths } = useAdminData();
  const { notify } = useToast();
  const [pending, setPending] = useState(null); // { type: 'renew' | 'cancel', sub }
  const [busy, setBusy] = useState(false);
  const opId = useRef(null);

  const request = (type) => (sub) => { opId.current = uid('op'); setPending({ type, sub }); };

  const confirm = async () => {
    if (busy || !pending) return;
    setBusy(true);
    try {
      const { type, sub } = pending;
      const result = await (type === 'renew' ? renew(sub.id, opId.current) : cancel(sub.id, opId.current));
      notify(result.ok ? `${sub.id} ${type === 'renew' ? 'renewed' : 'cancelled'}.` : result.errors?.form ?? 'Something went wrong.', result.ok ? 'success' : 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  let dialogs = null;
  if (pending) {
    const { type, sub } = pending;
    const userName = users.find((u) => u.id === sub.userId)?.name ?? 'this user';
    const renewal = type === 'renew' ? previewRenewal(sub, today, daysForMonths) : null;
    dialogs = (
      <ConfirmDialog
        open
        danger={type === 'cancel'}
        busy={busy}
        title={type === 'renew' ? `Renew ${sub.id}?` : `Cancel ${sub.id}?`}
        confirmLabel={type === 'renew' ? 'Renew subscription' : 'Cancel subscription'}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      >
        {type === 'renew' ? (
          <>
            <p>{userName} · {durationLabel(sub.durationMonths)} · {mealsLabel(sub.mealTypes)}</p>
            <p>The subscription will run until <strong className="text-ink">{formatDate(renewal.newEndDate)}</strong> and <strong className="text-ink">{renewal.creditsAdded}</strong> meal credits will be added. Unused credits carry over.</p>
          </>
        ) : (
          <>
            <p>{userName} · ends {formatDate(sub.endDate)}</p>
            <p>Their future scheduled meals will be cancelled. The subscription and its meal history stay on record. This cannot be undone here.</p>
          </>
        )}
      </ConfirmDialog>
    );
  }
  return { requestRenew: request('renew'), requestCancel: request('cancel'), dialogs };
}
