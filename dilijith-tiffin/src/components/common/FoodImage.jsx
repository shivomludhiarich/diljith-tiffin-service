import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

/** Shows the photo, or a flat placeholder if the file is missing or broken. */
export default function FoodImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-surface ${className}`}>
        <UtensilsCrossed className="h-10 w-10 text-muted/60" aria-hidden="true" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
