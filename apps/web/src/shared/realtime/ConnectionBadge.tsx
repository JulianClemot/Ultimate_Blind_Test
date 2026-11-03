import { cn } from '@/shared/lib/cn';

import { useRealtime } from './RealtimeContext';

export const ConnectionBadge = () => {
  const { connected } = useRealtime();
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span
        className={cn('size-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')}
        aria-hidden
      />
      {connected ? 'Connected' : 'Offline'}
    </span>
  );
};
