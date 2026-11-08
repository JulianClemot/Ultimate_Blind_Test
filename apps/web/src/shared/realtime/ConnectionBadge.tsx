import { useTranslation } from 'react-i18next';

import { useRealtime } from './RealtimeContext';

export const ConnectionBadge = () => {
  const { connected } = useRealtime();
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="eq" data-idle={!connected} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {connected ? t('common.connected') : t('common.offline')}
    </span>
  );
};
