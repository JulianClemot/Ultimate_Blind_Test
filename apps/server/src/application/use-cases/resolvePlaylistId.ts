import { PlaylistId, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { MusicCatalog } from '../ports/out';

/** Reads what the host typed: a playlist id, a playlist URL or a Deezer share link. */
export const resolvePlaylistId = (
  catalog: MusicCatalog,
  raw: string,
): Promise<Result<PlaylistId, UseCaseError>> =>
  PlaylistId.isShareLink(raw)
    ? catalog.resolveShareLink(raw.trim())
    : Promise.resolve(PlaylistId.parse(raw));
