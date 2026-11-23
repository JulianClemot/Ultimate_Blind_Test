import type { AnswerDto, SongDto } from '@ubt/shared';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { cn } from '@/shared/lib/cn';
import { roundTypeInfo } from '@/shared/lib/roundTypes';
import { findTeam, usesTeamMode } from '@/shared/lib/teams';
import { formatCountdown } from '@/shared/lib/time';
import { useCountdown } from '@/shared/lib/useCountdown';
import { useRecentGamesStore } from '@/shared/session/recentGamesStore';
import { useSessionStore, type PlayerSession } from '@/shared/session/sessionStore';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { PageLayout } from '@/shared/ui/PageLayout';
import { Recap } from '@/shared/ui/Recap';
import { EliminationPanel } from '@/shared/ui/EliminationPanel';
import { GameOverview } from '@/shared/ui/GameOverview';
import { Scoreboard } from '@/shared/ui/Scoreboard';
import { TeamScoreboard } from '@/shared/ui/TeamScoreboard';

import { AnswerForm } from './AnswerForm';
import { foundParts } from './playerGameState';
import { isGoneError, usePlayerGame } from './usePlayerGame';

const Found = ({ label, found }: { label: string; found: boolean }) => (
  <span
    className={cn(
      'rounded-full px-3 py-1 text-sm font-medium',
      found ? 'bg-success/15 text-success' : 'bg-secondary',
    )}
  >
    {label} {found ? '✓' : '?'}
  </span>
);

const SongProgress = ({ song, answers }: { song: SongDto; answers: readonly AnswerDto[] }) => {
  const { t } = useTranslation();
  const found = foundParts(answers);
  return (
    <div className="flex gap-2">
      {song.asksTitle && <Found label={t('player.title')} found={found.title} />}
      {song.asksArtist && <Found label={t('player.artist')} found={found.artist} />}
      {song.asksSource && (
        <Found
          label={t(song.roundType === 'game' ? 'player.game' : 'player.source')}
          found={found.source}
        />
      )}
    </div>
  );
};

const PlayerGame = ({ session }: { session: PlayerSession }) => {
  const { t } = useTranslation();
  const { state, rejoinError, kicked, submitAnswer } = usePlayerGame(session);
  const forget = useRecentGamesStore((s) => s.forget);
  const leave = () => forget(session.gameId);
  const song = state?.currentSong ?? null;
  const open = song !== null && !song.revealed;
  const hasAnswered = (state?.myAnswers.length ?? 0) > 0;
  // Out of a last-standing round: watching only, nothing to send.
  const isOut =
    state?.elimination != null &&
    !state.elimination.remaining.some((p) => p.id === session.playerId);
  const remaining = useCountdown(open ? song.startedAt + song.answerTimeSec * 1000 : null);

  if (kicked) {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3">
        <CardTitle className="mb-0">{t('player.kickedTitle')}</CardTitle>
        <p>{t('player.kicked')}</p>
        <Link to="/" className={buttonVariants()}>
          {t('common.backHome')}
        </Link>
      </Card>
    );
  }
  if (isGoneError(rejoinError)) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <CardTitle className="mb-0">{t('player.gameGoneTitle')}</CardTitle>
        <p>{t('player.gameGone')}</p>
        <Link to="/" className={buttonVariants()} onClick={leave}>
          {t('common.backHome')}
        </Link>
      </Card>
    );
  }
  if (rejoinError) return <ErrorMessage error={rejoinError} />;
  if (!state) return <p className="text-muted-foreground">{t('common.connecting')}</p>;

  if (state.status === 'finished') {
    // The recap follows `game:finished` by a few ms; the plain scores fill the gap.
    return (
      <>
        <Card role="status" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="mb-0">{t('player.gameOverTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('player.gameOver')}</p>
          </div>
          <Link to="/" className={buttonVariants({ variant: 'outline' })} onClick={leave}>
            {t('common.backHome')}
          </Link>
        </Card>
        {state.recap ? (
          <Recap
            recap={state.recap}
            playerId={state.player.id}
            {...(state.myTeamId && { teamId: state.myTeamId })}
          />
        ) : (
          <Card>
            <CardTitle>{t('player.finalScores', { name: state.name })}</CardTitle>
            <Scoreboard scores={state.scoreboard} playerId={state.player.id} />
          </Card>
        )}
      </>
    );
  }

  const teamRounds = usesTeamMode(state.rounds);
  const myTeam = findTeam(state.teams, state.myTeamId);
  const teammates = myTeam?.players.filter((p) => p.id !== state.player.id) ?? [];

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle className="mb-0">
          {state.player.name} · {state.name}
        </CardTitle>
        {myTeam && (
          <p className="rounded-lg bg-secondary p-3 text-sm" aria-label={t('player.yourTeamLabel')}>
            <Trans
              i18nKey="player.yourTeam"
              values={{ name: myTeam.name }}
              components={{ name: <span className="font-bold" /> }}
            />
            {teammates.length > 0 && (
              <>
                {' '}
                · {t('player.withTeammates', { names: teammates.map((p) => p.name).join(', ') })}
              </>
            )}
          </p>
        )}
        {teamRounds && !myTeam && !song && (
          <p className="text-sm text-muted-foreground">{t('player.teamsComing')}</p>
        )}
        {!song && <p>{t('player.waitingFirstSong')}</p>}

        {song && (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('common.round', { number: song.roundNumber })} ·{' '}
                {song.roundName || roundTypeInfo(song.roundType).label}
              </p>
              <p className="text-lg font-semibold">
                {song.roundType === 'last-standing'
                  ? t('common.songInRound', { number: song.number })
                  : t('common.song', { number: song.number, count: song.songCount })}
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
        )}

        {song && !isOut && <SongProgress song={song} answers={state.myAnswers} />}

        {song && state.elimination && (
          <EliminationPanel elimination={state.elimination} playerId={state.player.id} />
        )}

        {open && !isOut && state.everyoneAnswered && (
          <p role="status" className="rounded-lg bg-secondary p-4 text-center font-semibold">
            {t('player.everyoneAnswered')}
          </p>
        )}
        {open && !isOut && !state.everyoneAnswered && hasAnswered && (
          <p role="status" className="font-medium">
            {t('player.answerSent')}
          </p>
        )}
        {open && !isOut && !hasAnswered && remaining !== 0 && (
          <>
            <AnswerForm
              suggestions={song.suggestions}
              {...(song.asksSource && { source: song.roundType === 'game' ? 'game' : 'screen' })}
              onSubmit={(answer) => submitAnswer.mutate(answer)}
              pending={submitAnswer.isPending}
            />
            <ErrorMessage error={submitAnswer.error} />
          </>
        )}
        {open && !isOut && !hasAnswered && remaining === 0 && (
          <p className="text-muted-foreground">{t('player.timeIsUp')}</p>
        )}

        {state.reveal && (
          <div className="rounded-lg bg-secondary p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('common.itWas')}</p>
            <p className="text-2xl font-bold">{state.reveal.title}</p>
            <p className="text-lg">{state.reveal.artist}</p>
            {state.reveal.source && (
              <p className="text-sm text-muted-foreground">
                {t('common.from', { source: state.reveal.source })}
              </p>
            )}
          </div>
        )}
      </Card>

      {!song && state.rounds.length > 0 && (
        <Card>
          <CardTitle>
            {t('player.howItWorks', {
              rounds: t('common.roundCount', { count: state.rounds.length }),
            })}
          </CardTitle>
          <GameOverview rounds={state.rounds} />
        </Card>
      )}

      {teamRounds && state.teamScoreboard.length > 0 && (
        <Card>
          <CardTitle>{t('player.teamScores')}</CardTitle>
          <TeamScoreboard scores={state.teamScoreboard} teamId={state.myTeamId} />
        </Card>
      )}

      {state.scoreboard.length > 0 && (
        <Card>
          <CardTitle>{t('player.scores')}</CardTitle>
          <Scoreboard scores={state.scoreboard} playerId={state.player.id} />
        </Card>
      )}
    </>
  );
};

export const PlayerGamePage = () => {
  const { t } = useTranslation();
  const { gameId } = useParams();
  const tabSession = useSessionStore((s) => s.player);
  const recent = useRecentGamesStore((s) => s.games.find((g) => g.gameId === gameId));
  // The tab's session first; else the one remembered by this browser (closed tab, shared link).
  const session = tabSession?.gameId === gameId ? tabSession : recent;

  return (
    <PageLayout>
      {session ? (
        <PlayerGame
          session={{
            gameId: session.gameId,
            playerId: session.playerId,
            playerName: session.playerName,
          }}
        />
      ) : (
        <p>
          {t('player.notJoined')} <Link to="/">{t('player.joinAGame')}</Link>
        </p>
      )}
    </PageLayout>
  );
};
