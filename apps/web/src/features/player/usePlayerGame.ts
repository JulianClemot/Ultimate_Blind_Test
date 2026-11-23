import { useMutation } from '@tanstack/react-query';
import { useReducer, useState } from 'react';

import { useRealtime } from '@/shared/realtime/RealtimeContext';
import { useOnConnect } from '@/shared/realtime/useOnConnect';
import { useSocketEvent } from '@/shared/realtime/useSocketEvent';
import { useRecentGamesStore } from '@/shared/session/recentGamesStore';
import type { PlayerSession } from '@/shared/session/sessionStore';

import { playerGameReducer } from './playerGameState';

/** Rejoin errors meaning the party can never be resumed, as opposed to a transient failure. */
export const isGoneError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'GAME_NOT_FOUND' || code === 'UNKNOWN_PLAYER';
};

export const usePlayerGame = (session: PlayerSession) => {
  const { gateway } = useRealtime();
  const [state, dispatch] = useReducer(playerGameReducer, null);
  const [rejoinError, setRejoinError] = useState<unknown>(null);
  const [kicked, setKicked] = useState(false);
  const remember = useRecentGamesStore((s) => s.remember);
  const forget = useRecentGamesStore((s) => s.forget);

  useOnConnect(() => {
    gateway
      .rejoinGame({ gameId: session.gameId, playerId: session.playerId })
      .then((rejoined) => {
        setRejoinError(null);
        dispatch({ type: 'rejoined', session: rejoined });
        // Keeps the way back from the home page alive for as long as the party goes on.
        remember({
          gameId: rejoined.gameId,
          playerId: rejoined.player.id,
          playerName: rejoined.player.name,
          gameName: rejoined.name,
          code: rejoined.code,
        });
      })
      .catch(setRejoinError);
  });

  // The host removed someone: for the others the scoreboard and teams updates say it all.
  useSocketEvent('player:kicked', ({ playerId }) => {
    if (playerId !== session.playerId) return;
    setKicked(true);
    forget(session.gameId);
  });
  useSocketEvent('teams:updated', (teams) => dispatch({ type: 'teamsUpdated', teams }));
  useSocketEvent('team-scores:updated', (teamScoreboard) =>
    dispatch({ type: 'teamScoresUpdated', teamScoreboard }),
  );
  useSocketEvent('song:started', (song) => dispatch({ type: 'songStarted', song }));
  useSocketEvent('answer:judged', (answer) => dispatch({ type: 'answerJudged', answer }));
  useSocketEvent('song:all-answered', ({ songId }) => dispatch({ type: 'allAnswered', songId }));
  useSocketEvent('song:revealed', (reveal) => dispatch({ type: 'songRevealed', reveal }));
  useSocketEvent('scoreboard:updated', (scoreboard) =>
    dispatch({ type: 'scoreboardUpdated', scoreboard }),
  );
  useSocketEvent('elimination:updated', (elimination) =>
    dispatch({ type: 'eliminationUpdated', elimination }),
  );
  useSocketEvent('game:finished', (scoreboard) => dispatch({ type: 'gameFinished', scoreboard }));
  useSocketEvent('game:recap', (recap) => dispatch({ type: 'recapReceived', recap }));

  const submitAnswer = useMutation({
    mutationFn: ({ text, suggestionId }: { text: string; suggestionId?: string }) =>
      gateway.submitAnswer({
        text,
        clientSentAt: Date.now(),
        ...(suggestionId && { suggestionId }),
      }),
    onSuccess: (answer) => dispatch({ type: 'answerSent', answer }),
  });

  return { state, rejoinError, kicked, submitAnswer };
};
