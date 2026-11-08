import type { Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { AnalyzePlaylistCommand, AnalyzePlaylistUseCase } from '../ports/in';
import type { GameDesignRepository, MusicCatalog } from '../ports/out';
import type { PlaylistAnalysis, PlaylistAnalyzer } from '../services/PlaylistAnalyzer';
import { loadOwnedDesign } from './access';
import { resolvePlaylistId } from './resolvePlaylistId';

/**
 * Tells the host, while designing, whether a playlist is film or series music and which film
 * or series each track comes from. A lookup costs money, so only a design's owner may ask.
 */
export class AnalyzePlaylist implements AnalyzePlaylistUseCase {
  constructor(
    private readonly designs: GameDesignRepository,
    private readonly catalog: MusicCatalog,
    private readonly analyzer: PlaylistAnalyzer,
  ) {}

  async execute(command: AnalyzePlaylistCommand): Promise<Result<PlaylistAnalysis, UseCaseError>> {
    const design = await loadOwnedDesign(this.designs, command);
    if (!design.ok) return design;
    const id = await resolvePlaylistId(this.catalog, command.playlist);
    if (!id.ok) return id;
    const playlist = await this.catalog.playlist(id.value);
    if (!playlist.ok) return playlist;
    return { ok: true, value: await this.analyzer.analyze(playlist.value) };
  }
}
