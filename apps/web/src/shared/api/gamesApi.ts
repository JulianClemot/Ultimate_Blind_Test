import type { CreateGameResponseDto, GameStatusResponseDto } from '@ubt/shared';
import { useMutation, useQueries } from '@tanstack/react-query';

import type { DesignAccess } from './designsApi';
import { httpClient } from './httpClient';

export const gamesApi = {
  /** Starts a party from a saved design. */
  launch: (access: DesignAccess) =>
    httpClient.post<CreateGameResponseDto>('/api/games', { body: access }),
  /** Whether a party the player belongs to is still on; 404/422 once it is gone. */
  status: (gameId: string, playerId: string) =>
    httpClient.get<GameStatusResponseDto>(
      `/api/games/${encodeURIComponent(gameId)}/status?playerId=${encodeURIComponent(playerId)}`,
    ),
};

export const useLaunchGame = () => useMutation({ mutationFn: gamesApi.launch });

/**
 * The status of several parties at once, in the order given. Refetched when the page regains
 * focus (a phone waking up), so a list left open catches up with the host ending the party.
 */
export const useGameStatuses = (games: readonly { gameId: string; playerId: string }[]) =>
  useQueries({
    queries: games.map(({ gameId, playerId }) => ({
      queryKey: ['game-status', gameId, playerId],
      queryFn: () => gamesApi.status(gameId, playerId),
      retry: false,
    })),
  });
