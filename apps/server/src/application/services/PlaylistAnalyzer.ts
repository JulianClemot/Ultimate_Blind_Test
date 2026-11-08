import {
  classifyPlaylist,
  type PlaylistKind,
  type RoundPlan,
  type TrackSource,
} from '../../domain';
import type { MusicCatalog, Playlist, SourceResolver } from '../ports/out';

export interface PlaylistAnalysis {
  readonly playlist: Playlist;
  readonly kind: PlaylistKind;
  readonly lookup: 'ai' | 'metadata';
  /** Film or series by track id, before the host's corrections. */
  readonly sources: ReadonlyMap<string, TrackSource>;
}

/**
 * Detects whether a playlist is film or series music and which film or series each track comes
 * from. A lookup can take several seconds, so results are kept per playlist (and the pending
 * lookup is shared): the editor asks while the host designs, the game reuses the answer.
 */
export class PlaylistAnalyzer {
  static readonly MAX_CACHED_PLAYLISTS = 50;

  private readonly cache = new Map<string, Promise<PlaylistAnalysis>>();

  constructor(
    private readonly resolver: SourceResolver,
    private readonly catalog: MusicCatalog,
  ) {}

  analyze(playlist: Playlist): Promise<PlaylistAnalysis> {
    const key = `${playlist.id}:${playlist.tracks.map((track) => track.id).join(',')}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.resolver.resolve(playlist.tracks).then(({ sources, lookup }) => ({
      playlist,
      lookup,
      sources,
      kind: classifyPlaylist(sources, playlist.tracks.length),
    }));
    this.cache.set(key, pending);
    pending.catch(() => this.cache.delete(key));
    if (this.cache.size > PlaylistAnalyzer.MAX_CACHED_PLAYLISTS) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return pending;
  }

  /** Starts the lookups a launched game will need, so the first song does not wait for them. */
  warmUp(plans: readonly RoundPlan[]): void {
    const playlists = new Map(
      plans.filter((plan) => plan.rules.asks('source')).map((plan) => [plan.playlist.value, plan]),
    );
    for (const plan of playlists.values()) {
      void this.catalog
        .playlist(plan.playlist)
        .then((playlist) => (playlist.ok ? this.analyze(playlist.value) : undefined))
        .catch(() => undefined);
    }
  }
}
