import { useMutation } from '@tanstack/react-query';
import { useReducer, useState } from 'react';

import { useRealtime } from '@/shared/realtime/RealtimeContext';
import { useOnConnect } from '@/shared/realtime/useOnConnect';
import { useSocketEvent } from '@/shared/realtime/useSocketEvent';
import type { PlayerSession } from '@/shared/session/sessionStore';

import { playerGameReducer } from './playerGameState';

export const usePlayerGame = (session: PlayerSession) => {
  const { gateway } = useRealtime();
  const [state, dispatch] = useReducer(playerGameReducer, null);
  const [rejoinError, setRejoinError] = useState<unknown>(null);

  useOnConnect(() => {
    gateway
      .rejoinGame({ gameId: session.gameId, playerId: session.playerId })
      .then((rejoined) => {
        setRejoinError(null);
        dispatch({ type: 'rejoined', session: rejoined });
      })
      .catch(setRejoinError);
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
  useSocketEvent('game:finished', (scoreboard) => dispatch({ type: 'gameFinished', scoreboard }));
  useSocketEvent('game:recap', (recap) => dispatch({ type: 'recapReceived', recap }));

  const submitAnswer = useMutation({
    mutationFn: (text: string) => gateway.submitAnswer({ text, clientSentAt: Date.now() }),
    onSuccess: (answer) => dispatch({ type: 'answerSent', answer }),
  });

  return { state, rejoinError, submitAnswer };
};
