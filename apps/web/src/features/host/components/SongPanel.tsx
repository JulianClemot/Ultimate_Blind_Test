import type { HostSongDto, RevealDto } from '@ubt/shared';
import { useEffect, useRef } from 'react';

import { ROUND_TYPE_INFO } from '@/shared/lib/roundTypes';
import { formatCountdown } from '@/shared/lib/time';
import { useCountdown } from '@/shared/lib/useCountdown';
import { Button } from '@/shared/ui/button';

interface SongPanelProps {
  readonly song: HostSongDto | null;
  readonly reveal: RevealDto | null;
  readonly roundCount: number;
  readonly hasNextSong: boolean;
  /** Every player answered: the server reveals the song in a moment. */
  readonly everyoneAnswered: boolean;
  readonly pending: boolean;
  readonly onNext: () => void;
  readonly onReveal: () => void;
  readonly onReplay: () => void;
  readonly onStop: () => void;
}

/** Current song, its countdown and the host controls. Reveals automatically when time is up or everyone answered. */
export const SongPanel = ({
  song,
  reveal,
  roundCount,
  hasNextSong,
  everyoneAnswered,
  pending,
  onNext,
  onReveal,
  onReplay,
  onStop,
}: SongPanelProps) => {
  const open = song !== null && !song.revealed;
  const remaining = useCountdown(open ? song.startedAt + song.answerTimeSec * 1000 : null);
  const autoRevealed = useRef<string | null>(null);

  useEffect(() => {
    if (open && remaining === 0 && autoRevealed.current !== song.id) {
      autoRevealed.current = song.id;
      onReveal();
    }
  }, [open, remaining, song, onReveal]);

  const nextLabel = !song ? 'Play the first song' : hasNextSong ? 'Next song' : 'Show final scores';

  return (
    <div className="flex flex-col gap-4">
      {song ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Round {song.roundNumber}/{roundCount} ·{' '}
              {song.roundName || ROUND_TYPE_INFO[song.roundType].label}
            </p>
            <p className="text-lg font-semibold">
              Song {song.number}/{song.songCount}
            </p>
          </div>
          {open && remaining !== null && (
            <p className="font-mono text-4xl font-bold tabular-nums" aria-label="Seconds left">
              {formatCountdown(remaining)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Wait for everyone to join, then play the first song.
        </p>
      )}

      {open && everyoneAnswered && (
        <p role="status" className="rounded-lg bg-secondary p-4 text-center font-semibold">
          Everyone answered — revealing the result…
        </p>
      )}

      {reveal && (
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">It was</p>
          <p className="text-2xl font-bold">{reveal.title}</p>
          <p className="text-lg">{reveal.artist}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {open ? (
          <Button onClick={onReveal} disabled={pending}>
            Reveal now
          </Button>
        ) : (
          <Button onClick={onNext} disabled={pending}>
            {nextLabel}
          </Button>
        )}
        {song && (
          <>
            <Button variant="outline" onClick={onReplay}>
              Replay music
            </Button>
            <Button variant="outline" onClick={onStop}>
              Stop music
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
