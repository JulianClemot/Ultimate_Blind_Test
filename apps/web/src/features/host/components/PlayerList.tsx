import type { PlayerDto } from '@ubt/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/button';
import { CloseIcon } from '@/shared/ui/icons';

interface PlayerListProps {
  readonly players: readonly PlayerDto[];
  /** When given, each player gets a button to remove them (after a confirmation). */
  readonly onKick?: (player: PlayerDto) => void;
  readonly pending?: boolean;
}

export const PlayerList = ({ players, onKick, pending = false }: PlayerListProps) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('host.waitingPlayers')}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {players.map((player) => (
        <li
          key={player.id}
          className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm"
        >
          {player.name}
          {onKick && confirming !== player.id && (
            <Button
              variant="ghost"
              aria-label={t('host.kick', { name: player.name })}
              className="size-6 p-0"
              onClick={() => setConfirming(player.id)}
            >
              <CloseIcon className="size-3" />
            </Button>
          )}
          {onKick && confirming === player.id && (
            <span className="flex items-center gap-1" role="group">
              <Button
                variant="outline"
                disabled={pending}
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setConfirming(null);
                  onKick(player);
                }}
              >
                {t('host.kickConfirm', { name: player.name })}
              </Button>
              <Button
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setConfirming(null)}
              >
                {t('common.cancel')}
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};
