import type { EliminationDto } from '@ubt/shared';
import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/lib/cn';

interface EliminationPanelProps {
  readonly elimination: EliminationDto;
  /** Highlights this player and speaks to them directly. */
  readonly playerId?: string;
}

const Chips = ({
  label,
  players,
  playerId,
  out = false,
}: {
  label: string;
  players: EliminationDto['remaining'];
  playerId: string | undefined;
  out?: boolean;
}) =>
  players.length === 0 ? null : (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              out
                ? 'bg-secondary text-muted-foreground line-through'
                : 'bg-success/15 text-success',
              player.id === playerId && 'font-bold',
            )}
          >
            {player.name}
          </li>
        ))}
      </ul>
    </div>
  );

/** Who is still in the running of a last-standing round, who just left, and the winner. */
export const EliminationPanel = ({ elimination, playerId }: EliminationPanelProps) => {
  const { t } = useTranslation();
  const { remaining, eliminated, leftAfterCurrentSong } = elimination;
  const winner = remaining.length === 1 ? remaining[0] : undefined;
  const isIn = remaining.some((player) => player.id === playerId);

  return (
    <section className="flex flex-col gap-3" aria-label={t('elimination.title')}>
      {playerId !== undefined && !isIn && (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
          <span className="block font-bold">{t('elimination.youAreOutTitle')}</span>
          {t('elimination.youAreOut')}
        </p>
      )}
      {winner ? (
        <p role="status" className="rounded-lg bg-secondary p-3 text-center font-semibold">
          {winner.id === playerId
            ? t('elimination.youWon')
            : t('elimination.winner', { name: winner.name })}
        </p>
      ) : (
        <p className="font-medium">{t('elimination.remaining', { count: remaining.length })}</p>
      )}
      {leftAfterCurrentSong.length > 0 && (
        <p>
          {t('elimination.leftNow', { names: leftAfterCurrentSong.map((p) => p.name).join(', ') })}
        </p>
      )}
      <Chips label={t('elimination.stillIn')} players={remaining} playerId={playerId} />
      <Chips label={t('elimination.out')} players={eliminated} playerId={playerId} out />
    </section>
  );
};
