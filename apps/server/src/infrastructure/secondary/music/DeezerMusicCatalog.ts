import { z } from 'zod';

import {
  appError,
  type ApplicationFailure,
  type MusicCatalog,
  type Playlist,
} from '../../../application';
import { err, ok, PlaylistId, type Result, type Track } from '../../../domain';

const PAGE_SIZE = 100;
/** Upper bound on pages fetched, so a giant playlist cannot stall a song start. */
const MAX_PAGES = 20;
/** Deezer "DataException: no data", returned for unknown or private playlists. */
const DEEZER_NO_DATA = 800;

const errorSchema = z.object({ error: z.object({ code: z.number(), message: z.string() }) });
type DeezerError = z.infer<typeof errorSchema>;

const infoSchema = z.union([errorSchema, z.object({ id: z.number(), title: z.string() })]);

const pageSchema = z.union([
  errorSchema,
  z.object({
    data: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        readable: z.boolean().optional(),
        preview: z.string().optional(),
        artist: z.object({ name: z.string() }).optional(),
      }),
    ),
    next: z.string().optional(),
  }),
]);

const unavailable = (message: string): ApplicationFailure =>
  appError('MUSIC_CATALOG_UNAVAILABLE', `Deezer is unavailable: ${message}`);

/**
 * Reads playlists from the public Deezer API (no key needed). Each track
 * carries a 30 s preview whose position in the song is chosen by Deezer.
 */
export class DeezerMusicCatalog implements MusicCatalog {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  /**
   * A share link answers with a redirect whose `dest` parameter holds the playlist URL
   * (https://link.deezer.com/?dest=https%3A%2F%2Fwww.deezer.com%2Fplaylist%2F123…).
   * The redirect is read, never followed, and only `PlaylistId.isShareLink` URLs are fetched.
   */
  async resolveShareLink(link: string): Promise<Result<PlaylistId, ApplicationFailure>> {
    const notAPlaylist = appError(
      'PLAYLIST_NOT_FOUND',
      'This Deezer link does not point to a playlist',
    );
    if (!PlaylistId.isShareLink(link)) return err(notAPlaylist);

    let location: string | null;
    try {
      const response = await this.fetchFn(link.trim(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      location = response.headers.get('location');
    } catch (error) {
      return err(unavailable(error instanceof Error ? error.message : 'request failed'));
    }
    if (!location) return err(notAPlaylist);

    let target = location;
    try {
      target = new URL(location, link).searchParams.get('dest') ?? location;
    } catch {
      // Not a parseable URL: let PlaylistId try the raw text.
    }
    const id = PlaylistId.parse(target);
    return id.ok ? ok(id.value) : err(notAPlaylist);
  }

  async playlist(id: PlaylistId): Promise<Result<Playlist, ApplicationFailure>> {
    const info = await this.get(`playlist/${id.value}`, {}, infoSchema);
    if (!info.ok) return info;
    const tracks = await this.tracks(id);
    if (!tracks.ok) return tracks;
    return ok({ id: String(info.value.id), title: info.value.title, tracks: tracks.value });
  }

  private async tracks(id: PlaylistId): Promise<Result<Track[], ApplicationFailure>> {
    const tracks: Track[] = [];
    for (let page = 0, index = 0; page < MAX_PAGES; page++) {
      const result = await this.get(
        `playlist/${id.value}/tracks`,
        { limit: String(PAGE_SIZE), index: String(index) },
        pageSchema,
      );
      if (!result.ok) return result;
      const { data, next } = result.value;
      for (const item of data) {
        if (item.readable === false || !item.preview) continue;
        tracks.push({
          id: String(item.id),
          title: item.title,
          artist: item.artist?.name ?? '',
          previewUrl: item.preview,
        });
      }
      if (!next || data.length === 0) break;
      index += data.length;
    }
    return ok(tracks);
  }

  /** GETs a Deezer resource and maps its in-body errors (Deezer answers 200 with `{ error }`). */
  private async get<T extends object>(
    path: string,
    query: Record<string, string>,
    schema: z.ZodType<T | DeezerError>,
  ): Promise<Result<T, ApplicationFailure>> {
    const url = new URL(path, `${this.baseUrl.replace(/\/$/, '')}/`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let body: unknown;
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) return err(unavailable(`HTTP ${response.status}`));
      body = await response.json();
    } catch (error) {
      return err(unavailable(error instanceof Error ? error.message : 'request failed'));
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(unavailable('unexpected response'));
    const data = parsed.data;
    if ('error' in data) {
      return data.error.code === DEEZER_NO_DATA
        ? err(appError('PLAYLIST_NOT_FOUND', 'This Deezer playlist does not exist or is private'))
        : err(unavailable(data.error.message));
    }
    return ok(data);
  }
}
