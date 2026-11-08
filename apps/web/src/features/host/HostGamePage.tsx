import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { useSongMusic } from '@/shared/audio/useSongMusic';
import { usesTeamMode } from '@/shared/lib/teams';
import { useSessionStore, type HostSession } from '@/shared/session/sessionStore';
import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { PageLayout } from '@/shared/ui/PageLayout';
import { Recap } from '@/shared/ui/Recap';
import { GameOverview } from '@/shared/ui/GameOverview';
import { Scoreboard } from '@/shared/ui/Scoreboard';

import { AnswerList } from './components/AnswerList';
import { JoinQrCode } from './components/JoinQrCode';
import { PlayerList } from './components/PlayerList';
import { ScoreboardPanel } from './components/ScoreboardPanel';
import { SongPanel } from './components/SongPanel';
import { TeamsPanel } from './components/TeamsPanel';
import { useHostGame } from './useHostGame';

const HostGame = ({ session }: { session: HostSession }) => {
  const { t } = useTranslation();
  const { game, attachError, nextSong, revealSong, judgeAnswer, generateTeams, finishGame } =
    useHostGame(session);
  const [scoresOpen, setScoresOpen] = useState(false);
  const music = useSongMusic(game?.status === 'finished' ? null : (game?.currentSong ?? null));

  if (attachError) return <ErrorMessage error={attachError} />;
  if (!game) return <p className="text-muted-foreground">{t('common.connecting')}</p>;

  if (game.status === 'finished') {
    // The recap follows `game:finished` by a few ms; the plain scores fill the gap.
    if (game.recap) return <Recap recap={game.recap} />;
    return (
      <Card>
        <CardTitle>{t('player.finalScores', { name: game.name })}</CardTitle>
        <Scoreboard scores={game.scoreboard} />
      </Card>
    );
  }

  const song = game.currentSong;
  const teamRounds = usesTeamMode(game.rounds);
  const teamsMissing = teamRounds && game.teams.length === 0;
  return (
    <>
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t('host.joinWithCode', { name: game.name })}
          </p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{game.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            aria-pressed={scoresOpen}
            onClick={() => setScoresOpen((open) => !open)}
          >
            {t('host.scores')}
          </Button>
          {song?.revealed && (
            <Button
              variant="ghost"
              disabled={finishGame.isPending}
              onClick={() => finishGame.mutate()}
            >
              {t('host.endGame')}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <SongPanel
          song={song}
          reveal={game.reveal}
          roundCount={game.rounds.length}
          hasNextSong={game.hasNextSong}
          everyoneAnswered={game.everyoneAnswered}
          pending={nextSong.isPending || revealSong.isPending}
          onNext={() => nextSong.mutate()}
          onReveal={() => revealSong.mutate()}
          onReplay={music.replay}
          onStop={music.stop}
          nextBlockedReason={teamsMissing ? t('host.generateTeamsFirst') : null}
          teamSetup={
            teamRounds && (
              <TeamsPanel
                players={game.players}
                teams={game.teams}
                pending={generateTeams.isPending}
                error={generateTeams.error}
                onGenerate={(teamCount) => generateTeams.mutate(teamCount)}
              />
            )
          }
        />
        <ErrorMessage error={nextSong.error ?? revealSong.error ?? finishGame.error} />
      </Card>

      {song && (
        <Card>
          <CardTitle>{t('host.answers')}</CardTitle>
          <AnswerList
            answers={game.answers}
            asks={{ title: song.asksTitle, artist: song.asksArtist }}
            onJudge={(answer, verdict) => judgeAnswer.mutate({ answerId: answer.id, ...verdict })}
          />
          <ErrorMessage error={judgeAnswer.error} />
        </Card>
      )}

      {!song && (
        <Card>
          <CardTitle>
            {t('host.theGame', { rounds: t('common.roundCount', { count: game.rounds.length }) })}
          </CardTitle>
          <GameOverview rounds={game.rounds} />
        </Card>
      )}

      {!song && (
        <Card className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex-1">
            <CardTitle>{t('host.players', { count: game.players.length })}</CardTitle>
            <PlayerList players={game.players} />
          </div>
          <JoinQrCode code={game.code} />
        </Card>
      )}

      <ScoreboardPanel
        open={scoresOpen}
        scores={game.scoreboard}
        teamScores={teamRounds ? game.teamScoreboard : []}
        onClose={() => setScoresOpen(false)}
      />
    </>
  );
};

export const HostGamePage = () => {
  const { t } = useTranslation();
  const { gameId } = useParams();
  const session = useSessionStore((s) => s.host);

  return (
    <PageLayout>
      {session && session.gameId === gameId ? (
        <HostGame session={session} />
      ) : (
        <p>
          {t('host.notHost')} <Link to="/">{t('common.backHome')}</Link>
        </p>
      )}
    </PageLayout>
  );
};
