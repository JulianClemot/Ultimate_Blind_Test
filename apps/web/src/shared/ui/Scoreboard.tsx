import type { ScoreDto } from '@ubt/shared';

import { cn } from '@/shared/lib/cn';

interface ScoreboardProps {
  readonly scores: readonly ScoreDto[];
  /** Highlights this player's row. */
  readonly playerId?: string;
  readonly limit?: number;
}

/** Players ranked by points; ties share a rank. */
export const Scoreboard = ({ scores, playerId, limit }: ScoreboardProps) => {
  if (scores.length === 0) return <p className="text-sm text-muted-foreground">No player yet.</p>;
  // Scores arrive sorted best first: the first player with the same points gives the rank.
  const ranked = scores.map((score) => ({
    ...score,
    rank: scores.findIndex((s) => s.points === score.points) + 1,
  }));
  const shown = limit ? ranked.slice(0, limit) : ranked;
  return (
    <ol className="flex flex-col divide-y" aria-label="Scoreboard">
      {shown.map((score) => (
        <li
          key={score.playerId}
          className={cn(
            'flex items-baseline gap-3 py-2',
            score.playerId === playerId && 'font-semibold',
          )}
        >
          <span className="w-6 text-right font-mono text-muted-foreground">{score.rank}.</span>
          <span className="flex-1 truncate">{score.playerName}</span>
          <span className="font-mono tabular-nums">{score.points} pts</span>
        </li>
      ))}
    </ol>
  );
};
