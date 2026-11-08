import type { SourceMedium, Track, TrackSource } from './Track';

/** What the catalog's own metadata says about the film or series of a track. */
export interface SourceHint {
  readonly name: string;
  readonly medium: SourceMedium;
}

const QUOTES = '"“”«»„‟';
const PREFIXES = 'from|de|du|des|aus|del|dal|dalla|dall|da|uit|från';

/** `(From "Frozen")`, `(De "La Reine des Neiges"/Bande Originale…)`, `- From "Moana"`. */
const TITLE_HINT = new RegExp(
  `(?:[([]|\\s[-–—]\\s)\\s*(?:${PREFIXES})\\s+(?:the\\s+(?:motion\\s+picture|film|movie|series)\\s+)?[${QUOTES}]\\s*([^${QUOTES}]+?)\\s*[${QUOTES}]`,
  'i',
);

/** Album names like "Coco (Bande Originale Française du Film)" or "Frozen: Original Soundtrack". */
const SOUNDTRACK_WORDS =
  '(?:original\\s+(?:motion\\s+picture\\s+|television\\s+|tv\\s+|series\\s+|cast\\s+|(?:video\\s*)?game\\s+)?(?:soundtrack|score|cast\\s+recording)|(?:video\\s*)?game\\s+(?:soundtrack|ost|score)|music\\s+from\\b|bande\\s+originale|b\\.?o\\.?f?\\b|ost\\b|soundtrack|banda\\s+sonora|colonna\\s+sonora|filmmusik)';
const ALBUM_BRACKET = new RegExp(`^(.+?)\\s*[([]\\s*${SOUNDTRACK_WORDS}[^)\\]]*[)\\]]\\s*$`, 'i');
const ALBUM_COLON = new RegExp(`^(.+?)\\s*[:\\-–—]\\s*${SOUNDTRACK_WORDS}.*$`, 'i');

const GAME_WORDS =
  /\b(?:video\s*games?|videogames?|game\s+(?:soundtrack|ost|score)|jeux?\s+vid[ée]o|bande\s+originale\s+du\s+jeu|videojuego|videospiel)\b/i;

const SERIES_WORDS = /\b(?:tv|television|series|s[ée]rie|serie|show|cast)\b/i;

/** Albums that gather many films: their name says nothing about one track's film. */
const COMPILATION_WORDS =
  /\b(?:hits|best\s+of|collection|classics?|classiques|greatest|magie|magic|chansons|songs|plus\s+belles|compilation|vol(?:ume)?\.?\s*\d|anthology|essentials|favou?rites|party|karaoke|music\s+mania)\b/i;

const MAX_NAME_LENGTH = 80;

const clean = (name: string): string | null => {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return trimmed.length >= 2 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
};

/**
 * Reads the film or series out of a track's metadata, when the catalog spells it: in the title
 * (`Let It Go (From "Frozen")`) or in a soundtrack album (`Coco (Original Motion Picture
 * Soundtrack)`). Returns null when the metadata says nothing: the lookup service decides then.
 */
export const extractSourceHint = (track: Pick<Track, 'title' | 'album'>): SourceHint | null => {
  const fromTitle = TITLE_HINT.exec(track.title);
  const titleName = fromTitle?.[1] ? clean(fromTitle[1]) : null;
  const album = track.album ?? '';
  const text = `${album} ${track.title}`;
  const medium: SourceMedium = GAME_WORDS.test(text)
    ? 'game'
    : SERIES_WORDS.test(text)
      ? 'series'
      : 'movie';
  if (titleName) return { name: titleName, medium };

  const fromAlbum = ALBUM_BRACKET.exec(album) ?? ALBUM_COLON.exec(album);
  const albumName = fromAlbum?.[1] ? clean(fromAlbum[1]) : null;
  if (albumName && !COMPILATION_WORDS.test(albumName)) return { name: albumName, medium };
  return null;
};

export type PlaylistKind = 'movies' | 'series' | 'games' | 'mixed' | 'music';

/** Share of tracks that must have a source for the playlist to count as film, series or game music. */
export const SOURCE_PLAYLIST_SHARE = 0.4;
/** Share of one medium among the tracks with a source for the playlist to be named after it. */
const DOMINANT_MEDIUM_SHARE = 0.8;

const KIND_OF_MEDIUM = { movie: 'movies', series: 'series', game: 'games' } as const;

/**
 * Whether a playlist is film music, TV series music, video game music, a mix of these, or
 * ordinary music.
 */
export const classifyPlaylist = (
  sources: ReadonlyMap<string, TrackSource>,
  trackCount: number,
): PlaylistKind => {
  if (trackCount === 0 || sources.size / trackCount < SOURCE_PLAYLIST_SHARE) return 'music';
  const all = [...sources.values()];
  for (const medium of Object.keys(KIND_OF_MEDIUM) as SourceMedium[]) {
    const share = all.filter((source) => source.medium === medium).length / all.length;
    if (share >= DOMINANT_MEDIUM_SHARE) return KIND_OF_MEDIUM[medium];
  }
  return 'mixed';
};
/**
 * Applies the host's corrections to the sources found for a playlist: a name replaces what was
 * found (keeping its medium), null removes the track from the film and series rounds.
 */
export const withOverrides = (
  sources: ReadonlyMap<string, TrackSource>,
  overrides: Readonly<Record<string, string | null>>,
): Map<string, TrackSource> => {
  const result = new Map(sources);
  for (const [trackId, override] of Object.entries(overrides)) {
    const name = override?.replace(/\s+/g, ' ').trim() ?? '';
    const found = result.get(trackId);
    if (name.length === 0) result.delete(trackId);
    else if (found?.name !== name) {
      result.set(trackId, { name, aliases: [], medium: found?.medium ?? 'movie' });
    }
  }
  return result;
};
