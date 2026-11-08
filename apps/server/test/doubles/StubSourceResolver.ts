import type { SourceLookup, SourceResolver } from '../../src/application';
import type { Track, TrackSource } from '../../src/domain';

/** Knows the film or series of some tracks, by track id. */
export class StubSourceResolver implements SourceResolver {
  calls = 0;

  constructor(
    private readonly sources: Record<string, TrackSource> = {},
    private readonly lookup: SourceLookup['lookup'] = 'ai',
  ) {}

  resolve(tracks: readonly Track[]): Promise<SourceLookup> {
    this.calls += 1;
    const known = tracks.flatMap((track) => {
      const source = this.sources[track.id];
      return source ? [[track.id, source] as const] : [];
    });
    return Promise.resolve({ sources: new Map(known), lookup: this.lookup });
  }
}

export const frozen: TrackSource = {
  name: 'Frozen',
  aliases: ['La Reine des Neiges'],
  medium: 'movie',
};
