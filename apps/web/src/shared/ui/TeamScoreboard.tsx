import type { TeamScoreDto } from '@ubt/shared';
import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/lib/cn';

interface TeamScoreboardProps {
  readonly scores: readonly TeamScoreDto[];
  /** Highlights this team's row (the viewing player's team). */
  readonly teamId?: string | null;
}

/** Teams ranked by points; ties share a rank. */
export const TeamScoreboard = ({ scores, teamId }: TeamScoreboardProps) => {
  const { t } = useTranslation();
  if (scores.length === 0) return null;
  // Scores arrive sorted best first: the first team with the same points gives the rank.
  const ranked = scores.map((score) => ({
    ...score,
    rank: scores.findIndex((s) => s.points === score.points) + 1,
  }));
  return (
    <ol className="flex flex-col divide-y divide-ink/20" aria-label={t('recap.teamScoreboard')}>
      {ranked.map((score) => (
        <li
          key={score.teamId}
          className={cn(
            'flex items-baseline gap-3 py-2',
            score.rank === 1 && 'text-primary',
            score.teamId === teamId && 'font-semibold',
          )}
        >
          <span className="w-6 text-right font-mono text-muted-foreground">{score.rank}.</span>
          <span className="flex-1 truncate">{score.teamName}</span>
          <span className="font-mono tabular-nums">{t('common.pts', { value: score.points })}</span>
        </li>
      ))}
    </ol>
  );
};
