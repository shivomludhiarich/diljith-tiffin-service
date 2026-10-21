import { MessageCircle } from 'lucide-react';
import Button from '../common/Button';
import { BRAND } from '../../config/brand';
import { buildWhatsappUrl } from '../../utils/whatsapp';

/** Opens WhatsApp with a prefilled message. It only opens a chat: nothing is submitted or confirmed by the site. */
export default function WhatsAppButton({ label, message, variant = 'outline', className = '' }) {
  const url = buildWhatsappUrl(BRAND.whatsappNumber, message);
  if (!url) {
    return (
      <p className="text-xs text-muted">
        WhatsApp contact isn&apos;t set up yet. Set <code className="rounded bg-bg2 px-1">VITE_WHATSAPP_NUMBER</code> in the .env file.
      </p>
    );
  }
  return (
    <Button href={url} variant={variant} className={className} aria-label={`${label} (opens WhatsApp in a new tab)`}>
      <MessageCircle className="h-5 w-5" aria-hidden="true" />{label}
    </Button>
  );
}
