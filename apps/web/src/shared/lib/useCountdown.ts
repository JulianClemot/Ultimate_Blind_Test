import { useEffect, useState } from 'react';

/**
 * Milliseconds left until `deadline` (epoch ms), refreshed a few times per second.
 * Based on the local clock: good enough for display, the server decides what is late.
 */
export const useCountdown = (deadline: number | null): number | null => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  return deadline === null ? null : Math.max(0, deadline - now);
};
