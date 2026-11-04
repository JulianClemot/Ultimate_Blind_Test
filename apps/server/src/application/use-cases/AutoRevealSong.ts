import { err, ok, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type { AutoRevealSongCommand, AutoRevealSongUseCase } from '../ports/in';
import type { Clock, GameEventPublisher, GameRepository } from '../ports/out';

/**
 * Reveals a song on behalf of the server once every player answered it. It targets one song:
 * if the host already revealed it (or moved on) in the meantime, nothing happens.
 */
export class AutoRevealSong implements AutoRevealSongUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: AutoRevealSongCommand): Promise<Result<void, UseCaseError>> {
    const game = await this.games.findById(command.gameId);
    if (!game) return err(gameNotFound());

    const song = game.currentSong;
    if (song?.id !== command.songId || song.isRevealed) return ok(undefined);

    const revealed = game.revealSong(this.clock.now());
    if (!revealed.ok) return revealed;
    await this.games.save(game);
    this.events.songRevealed(game, revealed.value);
    return ok(undefined);
  }
}
