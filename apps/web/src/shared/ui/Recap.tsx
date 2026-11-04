import type { GameRecapDto, PlayerSongResultDto, ScoreDto } from '@ubt/shared';
import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import {
  buildShareCard,
  describeAward,
  renderShareCard,
  shareImage,
  type ShareOutcome,
} from '@/shared/lib/shareCard';
import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Scoreboard } from '@/shared/ui/Scoreboard';

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHTS = ['h-32', 'h-24', 'h-16'];

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Rank 1 in the middle, like a real podium: 2nd on its left, 3rd on its right. */
const podiumOrder = <T,>(top: readonly T[]): T[] => {
  const [first, second, third] = top;
  return [second, first, third].filter((entry): entry is T => entry !== undefined);
};

const Podium = ({ recap, playerId }: { recap: GameRecapDto; playerId?: string }) => (
  <ol aria-label="Podium" className="flex items-end justify-center gap-3">
    {podiumOrder(recap.standings.slice(0, 3)).map((standing) => (
      <li
        key={standing.playerId}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
      >
        <span className="text-3xl" aria-hidden>
          {MEDALS[standing.rank - 1] ?? ''}
        </span>
        <span
          className={cn(
            'max-w-full truncate font-bold',
            standing.playerId === playerId && 'text-primary',
          )}
        >
          {standing.playerName}
        </span>
        <span className="font-mono text-sm tabular-nums">{standing.points} pts</span>
        <div
          aria-hidden
          className={cn(
            'w-full rounded-t-lg border-2 border-ink',
            standing.rank === 1 ? 'bg-accent' : 'bg-secondary',
            PODIUM_HEIGHTS[standing.rank - 1] ?? 'h-12',
          )}
        />
      </li>
    ))}
  </ol>
);

const Awards = ({ recap }: { recap: GameRecapDto }) => (
  <ul aria-label="Awards" className="grid gap-3 sm:grid-cols-2">
    {recap.superlatives.map((award) => {
      const { icon, title, detail } = describeAward(award);
      return (
        <li
          key={award.kind}
          className="flex items-center gap-3 rounded-xl border-2 border-ink bg-secondary/50 p-3"
        >
          <span className="text-3xl" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="truncate font-bold">{award.playerName}</p>
            <p className="text-sm">{detail}</p>
          </div>
        </li>
      );
    })}
  </ul>
);

const resultSummary = (result: PlayerSongResultDto): string[] => {
  const parts: string[] = [];
  if (result.foundAtMs === null) parts.push('missed it');
  else {
    parts.push(seconds(result.foundAtMs));
    if (result.foundTitle !== result.foundArtist) {
      parts.push(result.foundTitle ? 'title only' : 'artist only');
    }
  }
  if (result.wrongAttempts > 0) parts.push(`${result.wrongAttempts} wrong`);
  return parts;
};

const SongReplay = ({ recap }: { recap: GameRecapDto }) => (
  <div className="flex flex-col gap-2">
    {recap.songs.map((song) => (
      <details key={song.songId} className="rounded-xl border-2 border-ink bg-card px-3 py-2">
        <summary className="cursor-pointer">
          <span className="text-sm text-muted-foreground">
            Round {song.roundNumber} · Song {song.number}
          </span>{' '}
          <span className="font-semibold">{song.title}</span>
          <span> · {song.artist}</span>
        </summary>
        <ul className="mt-2 flex flex-col divide-y divide-ink/20">
          {song.results.map((result) => (
            <li key={result.playerId} className="flex items-baseline gap-3 py-1 text-sm">
              <span className="flex-1 truncate font-medium">{result.playerName}</span>
              <span className="text-muted-foreground">{resultSummary(result).join(' · ')}</span>
              {result.points > 0 && (
                <span className="w-10 text-right font-mono tabular-nums">+{result.points}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
    ))}
  </div>
);

const ShareButton = ({ recap, playerId }: { recap: GameRecapDto; playerId?: string }) => {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [error, setError] = useState<unknown>(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const card = buildShareCard(recap, playerId);
      setOutcome(await shareImage(await renderShareCard(card), card.title));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="lg" disabled={busy} onClick={() => void share()}>
        {playerId ? 'Share my results' : 'Share the results'}
      </Button>
      {outcome === 'shared' && <p className="text-sm text-success">Shared!</p>}
      {outcome === 'downloaded' && <p className="text-sm text-success">Image downloaded</p>}
      <ErrorMessage error={error} />
    </div>
  );
};

interface RecapProps {
  readonly recap: GameRecapDto;
  /** The viewing player: highlights their row and words the share card for them. */
  readonly playerId?: string;
}

/** End-of-game screen: podium, awards, full ranking, replay of the songs and a share button. */
export const Recap = ({ recap, playerId }: RecapProps) => {
  const mine = recap.standings.find((s) => s.playerId === playerId);
  const scores: ScoreDto[] = recap.standings.map((s) => ({
    playerId: s.playerId,
    playerName: s.playerName,
    points: s.points,
  }));

  return (
    <>
      <Card className="flex flex-col gap-6">
        <CardTitle className="mb-0">{recap.gameName} — final results</CardTitle>
        <Podium recap={recap} {...(playerId && { playerId })} />
        {mine && (
          <p className="text-center text-lg font-semibold">
            {`You finished #${mine.rank} with ${mine.points} pts`}
          </p>
        )}
        <ShareButton recap={recap} {...(playerId && { playerId })} />
      </Card>

      {recap.superlatives.length > 0 && (
        <Card>
          <CardTitle>Awards</CardTitle>
          <Awards recap={recap} />
        </Card>
      )}

      <Card>
        <CardTitle>Ranking</CardTitle>
        <Scoreboard scores={scores} {...(playerId && { playerId })} />
      </Card>

      {recap.songs.length > 0 && (
        <Card>
          <CardTitle>The songs</CardTitle>
          <SongReplay recap={recap} />
        </Card>
      )}
    </>
  );
};
