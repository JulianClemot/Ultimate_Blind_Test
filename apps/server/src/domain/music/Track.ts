/** A song a round is about. Title and artist are the answer: they stay on the server. */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /** Short audio excerpt chosen by the catalog (30 s for Deezer); may expire. */
  readonly previewUrl: string;
}
