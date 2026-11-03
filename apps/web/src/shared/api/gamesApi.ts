import type { CreateGameResponseDto } from '@ubt/shared';
import { useMutation } from '@tanstack/react-query';

import type { DesignAccess } from './designsApi';
import { httpClient } from './httpClient';

export const gamesApi = {
  /** Starts a party from a saved design. */
  launch: (access: DesignAccess) =>
    httpClient.post<CreateGameResponseDto>('/api/games', { body: access }),
};

export const useLaunchGame = () => useMutation({ mutationFn: gamesApi.launch });
