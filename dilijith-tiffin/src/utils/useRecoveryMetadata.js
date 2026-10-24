import { useEffect } from 'react';

export default function useRecoveryMetadata(title) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Diljit Tiffin Service`;
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => { document.title = previousTitle; robots.remove(); };
  }, [title]);
}
