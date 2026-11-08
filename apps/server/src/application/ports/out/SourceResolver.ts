import type { Track, TrackSource } from '../../../domain';

export interface SourceLookup {
  /** Film, series or game of the tracks that come from one, by track id. The others are absent. */
  readonly sources: ReadonlyMap<string, TrackSource>;
  /** `ai`: a language model was asked; `metadata`: only what the catalog's metadata spells out. */
  readonly lookup: 'ai' | 'metadata';
}

/** Finds the film, series or game each track of a playlist comes from. Never fails: it degrades. */
export interface SourceResolver {
  resolve(tracks: readonly Track[]): Promise<SourceLookup>;
}
