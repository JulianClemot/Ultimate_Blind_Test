import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';

/** Asked when the host is about to leave a game that is still on (logo, back button…). */
export const LeaveGameDialog = ({
  pending,
  error,
  onEnd,
  onLeave,
  onStay,
}: {
  pending: boolean;
  error: unknown;
  onEnd: () => void;
  onLeave: () => void;
  onStay: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-game-title"
        className="flex w-full max-w-md flex-col gap-4"
      >
        <CardTitle id="leave-game-title" className="mb-0">
          {t('host.leaveTitle')}
        </CardTitle>
        <p>{t('host.leaveBody')}</p>
        <ErrorMessage error={error} />
        <div className="flex flex-col gap-2">
          <Button disabled={pending} onClick={onEnd}>
            {t('host.endForEveryone')}
          </Button>
          <Button variant="outline" disabled={pending} onClick={onLeave}>
            {t('host.keepRunning')}
          </Button>
          <Button variant="ghost" autoFocus disabled={pending} onClick={onStay}>
            {t('host.stay')}
          </Button>
        </div>
      </Card>
    </div>
  );
};
