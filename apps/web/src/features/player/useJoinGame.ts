import type { JoinGamePayload } from '@ubt/shared';
import { useMutation } from '@tanstack/react-query';

import { useRealtime } from '@/shared/realtime/RealtimeContext';
import { useSessionStore } from '@/shared/session/sessionStore';

export const useJoinGame = () => {
  const { gateway } = useRealtime();
  const setPlayer = useSessionStore((s) => s.setPlayer);

  return useMutation({
    mutationFn: (payload: JoinGamePayload) => gateway.joinGame(payload),
    onSuccess: (session) =>
      setPlayer({
        gameId: session.gameId,
        playerId: session.player.id,
        playerName: session.player.name,
      }),
  });
};
