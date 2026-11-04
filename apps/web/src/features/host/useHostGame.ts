import type { JudgeAnswerPayload } from '@ubt/shared';
import { useMutation } from '@tanstack/react-query';
import { useReducer, useState } from 'react';

import { useRealtime } from '@/shared/realtime/RealtimeContext';
import { useOnConnect } from '@/shared/realtime/useOnConnect';
import { useSocketEvent } from '@/shared/realtime/useSocketEvent';
import type { HostSession } from '@/shared/session/sessionStore';

import { hostGameReducer } from './hostGameState';

export const useHostGame = (session: HostSession) => {
  const { gateway } = useRealtime();
  const [game, dispatch] = useReducer(hostGameReducer, null);
  const [attachError, setAttachError] = useState<unknown>(null);

  useOnConnect(() => {
    gateway
      .attachHost(session)
      .then((snapshot) => {
        setAttachError(null);
        dispatch({ type: 'attached', snapshot });
      })
      .catch(setAttachError);
  });

  useSocketEvent('player:joined', (player) => dispatch({ type: 'playerJoined', player }));
  useSocketEvent('host:song-started', (song) => dispatch({ type: 'songStarted', song }));
  useSocketEvent('answer:received', (answer) => dispatch({ type: 'answerReceived', answer }));
  useSocketEvent('answer:judged', (answer) => dispatch({ type: 'answerJudged', answer }));
  useSocketEvent('song:revealed', (reveal) => dispatch({ type: 'songRevealed', reveal }));
  useSocketEvent('scoreboard:updated', (scoreboard) =>
    dispatch({ type: 'scoreboardUpdated', scoreboard }),
  );
  useSocketEvent('game:finished', (scoreboard) => dispatch({ type: 'gameFinished', scoreboard }));
  useSocketEvent('game:recap', (recap) => dispatch({ type: 'recapReceived', recap }));

  // Acks are dispatched too: the matching events may arrive before or after them.
  const nextSong = useMutation({
    mutationFn: () => gateway.nextSong(),
    onSuccess: (result) =>
      dispatch(
        result.kind === 'song'
          ? { type: 'songStarted', song: result.song }
          : { type: 'gameFinished', scoreboard: result.scoreboard },
      ),
  });
  const revealSong = useMutation({
    mutationFn: () => gateway.revealSong(),
    onSuccess: (reveal) => dispatch({ type: 'songRevealed', reveal }),
  });
  const judgeAnswer = useMutation({
    mutationFn: (payload: JudgeAnswerPayload) => gateway.judgeAnswer(payload),
    onSuccess: (answer) => dispatch({ type: 'answerJudged', answer }),
  });
  const finishGame = useMutation({
    mutationFn: () => gateway.finishGame(),
    onSuccess: (scoreboard) => dispatch({ type: 'gameFinished', scoreboard }),
  });

  return { game, attachError, nextSong, revealSong, judgeAnswer, finishGame };
};
