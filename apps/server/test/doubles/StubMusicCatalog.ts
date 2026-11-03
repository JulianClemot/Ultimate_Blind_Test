import type { ApplicationFailure, MusicCatalog, Playlist } from '../../src/application';
import { err, ok, PlaylistId, type Result, type Track } from '../../src/domain';

export const track = (id: string): Track => ({
  id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  previewUrl: `https://cdn.test/${id}.mp3`,
});

/** Serves fixed playlists by id; unknown ids are reported as not found. */
export class StubMusicCatalog implements MusicCatalog {
  readonly requests: string[] = [];
  readonly shareLinkRequests: string[] = [];
  failure: ApplicationFailure | null = null;

  /** `shareLinks` maps a share link to the id of the playlist it points to. */
  constructor(
    private readonly playlists: Record<string, readonly Track[]> = {},
    private readonly shareLinks: Record<string, string> = {},
  ) {}

  resolveShareLink(link: string): Promise<Result<PlaylistId, ApplicationFailure>> {
    this.shareLinkRequests.push(link);
    if (this.failure) return Promise.resolve(err(this.failure));
    const parsed = PlaylistId.parse(this.shareLinks[link] ?? '');
    return Promise.resolve(
      parsed.ok
        ? ok(parsed.value)
        : err({
            code: 'PLAYLIST_NOT_FOUND',
            message: 'This Deezer link does not point to a playlist',
          }),
    );
  }

  playlist(id: PlaylistId): Promise<Result<Playlist, ApplicationFailure>> {
    this.requests.push(id.value);
    if (this.failure) return Promise.resolve(err(this.failure));
    const tracks = this.playlists[id.value];
    return Promise.resolve(
      tracks
        ? ok({ id: id.value, title: `Playlist ${id.value}`, tracks })
        : err({ code: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found' }),
    );
  }
}
