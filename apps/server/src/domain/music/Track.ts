/** What a track can come from: a film, a TV series or a video game. */
export type SourceMedium = 'movie' | 'series' | 'game';

/** The film, TV series or video game a track comes from. */
export interface TrackSource {
  /** Name shown to players, e.g. "Frozen". */
  readonly name: string;
  /** Other names accepted as an answer, e.g. the title in another language. */
  readonly aliases: readonly string[];
  readonly medium: SourceMedium;
}

/** A song a round is about. Title and artist are the answer: they stay on the server. */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /** Short audio excerpt chosen by the catalog (30 s for Deezer); may expire. */
  readonly previewUrl: string;
  /** Title of the album the catalog lists the track on, when known. */
  readonly album?: string;
  /** Film, series or game the track comes from, once looked up. Never sent before the reveal. */
  readonly source?: TrackSource;
}

/** What a player picks in an easy round, without any audio. */
export type Suggestion = { readonly id: string; readonly label: string } & (
  | {
      /** A song of the playlist: "Artist – Title". */
      readonly kind: 'track';
      readonly title: string;
      readonly artist: string;
    }
  | {
      /** A film, series or game the playlist's tracks come from. */
      readonly kind: 'source';
      readonly source: string;
    }
);

export const trackLabel = (track: Pick<Track, 'title' | 'artist'>): string =>
  track.artist ? `${track.artist} – ${track.title}` : track.title;
