import type { HostSongDto, RevealDto } from '@ubt/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { roundTypeInfo } from '@/shared/lib/roundTypes';
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
  /** Lobby only: shown right above the start button (the teams generator). */
  readonly teamSetup?: ReactNode;
  /** Why the next song cannot be played yet, e.g. teams still to generate. */
  readonly nextBlockedReason?: string | null;
}

/** The answer, shown only while hovered or focused so the host can give oral clues. */
const HostPeek = ({ song }: { song: HostSongDto }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <button
      type="button"
      aria-label={t('host.peekLabel')}
      className="rounded-lg border border-dashed p-3 text-left text-sm"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {visible ? (
        <span className="font-medium">
          {song.artist} – {song.title}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('host.peekHint')}</span>
      )}
    </button>
  );
};

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
  teamSetup,
  nextBlockedReason = null,
}: SongPanelProps) => {
  const { t } = useTranslation();
  const open = song !== null && !song.revealed;
  const remaining = useCountdown(open ? song.startedAt + song.answerTimeSec * 1000 : null);
  const autoRevealed = useRef<string | null>(null);

  useEffect(() => {
    if (open && remaining === 0 && autoRevealed.current !== song.id) {
      autoRevealed.current = song.id;
      onReveal();
    }
  }, [open, remaining, song, onReveal]);

  const nextLabel = !song
    ? t('host.playFirst')
    : hasNextSong
      ? t('host.nextSong')
      : t('host.showFinal');

  return (
    <div className="flex flex-col gap-4">
      {song ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('common.roundOf', { number: song.roundNumber, count: roundCount })} ·{' '}
              {song.roundName || roundTypeInfo(song.roundType).label}
            </p>
            <p className="text-lg font-semibold">
              {t('common.song', { number: song.number, count: song.songCount })}
            </p>
          </div>
          {open && remaining !== null && (
            <p
              className="font-mono text-4xl font-bold tabular-nums"
              aria-label={t('common.secondsLeft')}
            >
              {formatCountdown(remaining)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">{t('host.waitForJoin')}</p>
      )}

      {open && <HostPeek song={song} />}

      {open && everyoneAnswered && (
        <p role="status" className="rounded-lg bg-secondary p-4 text-center font-semibold">
          {t('host.revealing')}
        </p>
      )}

      {reveal && (
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">{t('common.itWas')}</p>
          <p className="text-2xl font-bold">{reveal.title}</p>
          <p className="text-lg">{reveal.artist}</p>
        </div>
      )}

      {!song && teamSetup}

      {!open && nextBlockedReason && (
        <p role="status" className="text-sm text-warning">
          {nextBlockedReason}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {open ? (
          <Button onClick={onReveal} disabled={pending}>
            {t('host.revealNow')}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={pending || nextBlockedReason !== null}>
            {nextLabel}
          </Button>
        )}
        {song && (
          <>
            <Button variant="outline" onClick={onReplay}>
              {t('host.replayMusic')}
            </Button>
            <Button variant="outline" onClick={onStop}>
              {t('host.stopMusic')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
