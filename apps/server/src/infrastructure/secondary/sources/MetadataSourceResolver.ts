import type { SourceLookup, SourceResolver } from '../../../application';
import { extractSourceHint, type Track, type TrackSource } from '../../../domain';

/** Reads the film or series only where Deezer's own titles and album names spell it out. */
export class MetadataSourceResolver implements SourceResolver {
  resolve(tracks: readonly Track[]): Promise<SourceLookup> {
    return Promise.resolve({ lookup: 'metadata', sources: this.read(tracks) });
  }

  read(tracks: readonly Track[]): Map<string, TrackSource> {
    const sources = new Map<string, TrackSource>();
    for (const track of tracks) {
      const hint = extractSourceHint(track);
      if (hint) sources.set(track.id, { name: hint.name, aliases: [], medium: hint.medium });
    }
    return sources;
  }
}
