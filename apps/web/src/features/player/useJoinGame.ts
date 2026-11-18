import type { JoinGamePayload } from '@ubt/shared';
import { useMutation } from '@tanstack/react-query';

import { useRealtime } from '@/shared/realtime/RealtimeContext';
import { useRecentGamesStore } from '@/shared/session/recentGamesStore';
import { useSessionStore } from '@/shared/session/sessionStore';

export const useJoinGame = () => {
  const { gateway } = useRealtime();
  const setPlayer = useSessionStore((s) => s.setPlayer);
  const remember = useRecentGamesStore((s) => s.remember);

  return useMutation({
    mutationFn: (payload: JoinGamePayload) => gateway.joinGame(payload),
    onSuccess: (session) => {
      const player = {
        gameId: session.gameId,
        playerId: session.player.id,
        playerName: session.player.name,
      };
      setPlayer(player);
      remember({ ...player, gameName: session.name, code: session.code });
    },
  });
};
