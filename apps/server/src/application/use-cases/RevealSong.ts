import { ok, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { HostCommand, RevealedSong, RevealSongUseCase } from '../ports/in';
import type { Clock, GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Closes the current song and shows everyone what it was, with the updated scores. */
export class RevealSong implements RevealSongUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: HostCommand): Promise<Result<RevealedSong, UseCaseError>> {
    const game = await loadHostedGame(this.games, command);
    if (!game.ok) return game;

    const song = game.value.revealSong(this.clock.now());
    if (!song.ok) return song;
    await this.games.save(game.value);
    this.events.songRevealed(game.value, song.value);
    return ok({ game: game.value, song: song.value });
  }
}
