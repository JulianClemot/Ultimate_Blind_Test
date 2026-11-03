import type { PlaylistId, Result, Track } from '../../../domain';
import type { ApplicationFailure } from '../../errors';

export interface Playlist {
  readonly id: string;
  readonly title: string;
  /** Only the tracks with a playable preview. */
  readonly tracks: readonly Track[];
}

/** Source of songs for rounds (Deezer in production). */
export interface MusicCatalog {
  /**
   * Finds the playlist a Deezer share link (`PlaylistId.isShareLink`) points to.
   * Fails with PLAYLIST_NOT_FOUND (not a playlist) or MUSIC_CATALOG_UNAVAILABLE.
   */
  resolveShareLink(link: string): Promise<Result<PlaylistId, ApplicationFailure>>;

  /** Fails with PLAYLIST_NOT_FOUND or MUSIC_CATALOG_UNAVAILABLE. */
  playlist(id: PlaylistId): Promise<Result<Playlist, ApplicationFailure>>;
}
