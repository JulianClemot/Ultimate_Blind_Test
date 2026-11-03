import { gameError, type GameError } from '../game/GameErrors';
import { err, ok, type Result } from '../shared/Result';

const BARE_ID = /^(\d{1,20})$/;
const PLAYLIST_URL = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d{1,20})(?:[/?#]|$)/i;

const SHARE_LINK = /^https:\/\/link\.deezer\.com\/s\/[A-Za-z0-9]+\/?$/;

/** A Deezer playlist reference, given either as its numeric id or as a playlist URL. */
export class PlaylistId {
  private constructor(readonly value: string) {}

  /**
   * Whether the text is a Deezer "Share" short link (https://link.deezer.com/s/…). It does not
   * contain the playlist id: a MusicCatalog has to follow it to find the playlist.
   */
  static isShareLink(raw: string): boolean {
    return SHARE_LINK.test(raw.trim());
  }

  static parse(raw: string): Result<PlaylistId, GameError> {
    const input = raw.trim();
    const id = BARE_ID.exec(input)?.[1] ?? PLAYLIST_URL.exec(input)?.[1];
    return id
      ? ok(new PlaylistId(id))
      : err(
          gameError(
            'INVALID_PLAYLIST',
            'Expected a Deezer playlist id, playlist URL or share link',
          ),
        );
  }
}
