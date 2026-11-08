/** A song a round is about. Title and artist are the answer: they stay on the server. */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /** Short audio excerpt chosen by the catalog (30 s for Deezer); may expire. */
  readonly previewUrl: string;
}

/** What a player picks in an easy round: a track of the round's playlist, without its audio. */
export interface Suggestion {
  readonly id: string;
  /** "Artist – Title", also the text of the answer when picked. */
  readonly label: string;
  readonly title: string;
  readonly artist: string;
}

export const trackLabel = (track: Pick<Track, 'title' | 'artist'>): string =>
  track.artist ? `${track.artist} – ${track.title}` : track.title;
