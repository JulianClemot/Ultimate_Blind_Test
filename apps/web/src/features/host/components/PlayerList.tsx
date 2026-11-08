import type { PlayerDto } from '@ubt/shared';
import { useTranslation } from 'react-i18next';

export const PlayerList = ({ players }: { players: readonly PlayerDto[] }) => {
  const { t } = useTranslation();
  return players.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('host.waitingPlayers')}</p>
  ) : (
    <ul className="flex flex-wrap gap-2">
      {players.map((player) => (
        <li key={player.id} className="rounded-full bg-secondary px-3 py-1 text-sm">
          {player.name}
        </li>
      ))}
    </ul>
  );
};
