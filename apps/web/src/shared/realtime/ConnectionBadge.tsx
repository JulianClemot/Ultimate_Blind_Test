import { useRealtime } from './RealtimeContext';

export const ConnectionBadge = () => {
  const { connected } = useRealtime();
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="eq" data-idle={!connected} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {connected ? 'Connected' : 'Offline'}
    </span>
  );
};
