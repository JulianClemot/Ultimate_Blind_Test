import type { AnswerDto, SongDto } from '@ubt/shared';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';

import { cn } from '@/shared/lib/cn';
import { ROUND_TYPE_INFO } from '@/shared/lib/roundTypes';
import { formatCountdown } from '@/shared/lib/time';
import { useCountdown } from '@/shared/lib/useCountdown';
import { useSessionStore, type PlayerSession } from '@/shared/session/sessionStore';
import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Input } from '@/shared/ui/input';
import { PageLayout } from '@/shared/ui/PageLayout';
import { GameOverview } from '@/shared/ui/GameOverview';
import { Scoreboard } from '@/shared/ui/Scoreboard';

import { foundParts, hasFoundEverything } from './playerGameState';
import { usePlayerGame } from './usePlayerGame';

const AnswerForm = ({ onSubmit, pending }: { onSubmit: (t: string) => void; pending: boolean }) => {
  const [text, setText] = useState('');
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(text);
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Your answer"
        placeholder="Artist – Title"
        autoFocus
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" size="xl" disabled={!text.trim() || pending}>
        Answer!
      </Button>
    </form>
  );
};

const Found = ({ label, found }: { label: string; found: boolean }) => (
  <span
    className={cn(
      'rounded-full px-3 py-1 text-sm font-medium',
      found ? 'bg-green-600/15 text-green-700 dark:text-green-400' : 'bg-secondary',
    )}
  >
    {label} {found ? '✓' : '?'}
  </span>
);

const SongProgress = ({ song, answers }: { song: SongDto; answers: readonly AnswerDto[] }) => {
  const found = foundParts(answers);
  return (
    <div className="flex gap-2">
      {song.asksTitle && <Found label="Title" found={found.title} />}
      {song.asksArtist && <Found label="Artist" found={found.artist} />}
    </div>
  );
};

const PlayerGame = ({ session }: { session: PlayerSession }) => {
  const { state, rejoinError, submitAnswer } = usePlayerGame(session);
  const song = state?.currentSong ?? null;
  const open = song !== null && !song.revealed;
  const remaining = useCountdown(open ? song.startedAt + song.answerTimeSec * 1000 : null);

  if (rejoinError) return <ErrorMessage error={rejoinError} />;
  if (!state) return <p className="text-muted-foreground">Connecting to the game…</p>;

  if (state.status === 'finished') {
    return (
      <Card>
        <CardTitle>{state.name} — final scores</CardTitle>
        <Scoreboard scores={state.scoreboard} playerId={state.player.id} />
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle className="mb-0">
          {state.player.name} · {state.name}
        </CardTitle>
        {!song && <p>Waiting for the host to play the first song…</p>}

        {song && (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Round {song.roundNumber} · {song.roundName || ROUND_TYPE_INFO[song.roundType].label}
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
        )}

        {song && <SongProgress song={song} answers={state.myAnswers} />}

        {open && remaining !== 0 && !hasFoundEverything(song, state.myAnswers) && (
          <>
            <AnswerForm onSubmit={(t) => submitAnswer.mutate(t)} pending={submitAnswer.isPending} />
            <ErrorMessage error={submitAnswer.error} />
          </>
        )}
        {open && hasFoundEverything(song, state.myAnswers) && (
          <p className="font-medium">Well done! Wait for the reveal…</p>
        )}
        {open && remaining === 0 && <p className="text-muted-foreground">Time is up!</p>}

        {state.reveal && (
          <div className="rounded-lg bg-secondary p-4 text-center">
            <p className="text-sm text-muted-foreground">It was</p>
            <p className="text-2xl font-bold">{state.reveal.title}</p>
            <p className="text-lg">{state.reveal.artist}</p>
          </div>
        )}
      </Card>

      {!song && state.rounds.length > 0 && (
        <Card>
          <CardTitle>
            How the game works · {state.rounds.length} round{state.rounds.length === 1 ? '' : 's'}
          </CardTitle>
          <GameOverview rounds={state.rounds} />
        </Card>
      )}

      {state.scoreboard.length > 0 && (
        <Card>
          <CardTitle>Scores</CardTitle>
          <Scoreboard scores={state.scoreboard} playerId={state.player.id} />
        </Card>
      )}
    </>
  );
};

export const PlayerGamePage = () => {
  const { gameId } = useParams();
  const session = useSessionStore((s) => s.player);

  return (
    <PageLayout>
      {session && session.gameId === gameId ? (
        <PlayerGame session={session} />
      ) : (
        <p>
          You have not joined this game. <Link to="/">Join a game</Link>
        </p>
      )}
    </PageLayout>
  );
};
