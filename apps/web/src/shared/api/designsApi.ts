import type {
  CreateGameDesignResponseDto,
  GameDesignDto,
  PlaylistSummaryDto,
  RoundCatalogDto,
  UpdateGameDesignPayload,
} from '@ubt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { httpClient } from './httpClient';

export interface DesignAccess {
  readonly designId: string;
  readonly editToken: string;
}

export const designsApi = {
  roundCatalog: () => httpClient.get<RoundCatalogDto>('/api/round-catalog'),
  create: (name: string) =>
    httpClient.post<CreateGameDesignResponseDto>('/api/designs', { body: { name } }),
  get: ({ designId, editToken }: DesignAccess) =>
    httpClient.get<GameDesignDto>(`/api/designs/${designId}`, { token: editToken }),
  save: ({ designId, editToken }: DesignAccess, payload: UpdateGameDesignPayload) =>
    httpClient.put<GameDesignDto>(`/api/designs/${designId}`, { body: payload, token: editToken }),
  delete: ({ designId, editToken }: DesignAccess) =>
    httpClient.delete<undefined>(`/api/designs/${designId}`, { token: editToken }),
  checkPlaylist: (playlist: string) =>
    httpClient.get<PlaylistSummaryDto>(
      `/api/playlists/check?playlist=${encodeURIComponent(playlist)}`,
    ),
};

const designKey = (designId: string) => ['designs', designId] as const;

export const useRoundCatalog = () =>
  useQuery({ queryKey: ['round-catalog'], queryFn: designsApi.roundCatalog, staleTime: Infinity });

export const useDesign = (access: DesignAccess) =>
  useQuery({ queryKey: designKey(access.designId), queryFn: () => designsApi.get(access) });

export const useCreateDesign = () => useMutation({ mutationFn: designsApi.create });

export const useSaveDesign = (access: DesignAccess) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateGameDesignPayload) => designsApi.save(access, payload),
    onSuccess: (design) => queryClient.setQueryData(designKey(access.designId), design),
  });
};

export const useDeleteDesign = () => useMutation({ mutationFn: designsApi.delete });

export const useCheckPlaylist = () => useMutation({ mutationFn: designsApi.checkPlaylist });
