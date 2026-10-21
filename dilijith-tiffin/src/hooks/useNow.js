import { useEffect, useState } from 'react';

/** The current time, refreshed on an interval so deadlines flip from "open" to "closed" without a reload. */
export default function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
