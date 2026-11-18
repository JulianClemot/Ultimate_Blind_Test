import { ok, type Game, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { CloseGameUseCase, HostCommand } from '../ports/in';
import type { GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Ends the party for everyone at the host's request, even before the current song is revealed. */
export class CloseGame implements CloseGameUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: HostCommand): Promise<Result<Game, UseCaseError>> {
    const game = await loadHostedGame(this.games, command);
    if (!game.ok) return game;

    const closed = game.value.close();
    if (!closed.ok) return closed;
    await this.games.save(game.value);
    this.events.gameFinished(game.value);
    return ok(game.value);
  }
}
