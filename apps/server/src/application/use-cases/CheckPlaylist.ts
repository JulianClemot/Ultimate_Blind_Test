import type { Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { CheckPlaylistCommand, CheckPlaylistUseCase } from '../ports/in';
import type { MusicCatalog, Playlist } from '../ports/out';
import { resolvePlaylistId } from './resolvePlaylistId';

/** Lets the host check a playlist while designing: it exists and has enough playable tracks. */
export class CheckPlaylist implements CheckPlaylistUseCase {
  constructor(private readonly catalog: MusicCatalog) {}

  async execute({ playlist }: CheckPlaylistCommand): Promise<Result<Playlist, UseCaseError>> {
    const id = await resolvePlaylistId(this.catalog, playlist);
    if (!id.ok) return id;
    return this.catalog.playlist(id.value);
  }
}
