import { ok, type Game, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { FinishGameUseCase, HostCommand } from '../ports/in';
import type { GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Ends the party before the last round, e.g. when it is getting late. */
export class FinishGame implements FinishGameUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: HostCommand): Promise<Result<Game, UseCaseError>> {
    const game = await loadHostedGame(this.games, command);
    if (!game.ok) return game;

    const finished = game.value.finish();
    if (!finished.ok) return finished;
    await this.games.save(game.value);
    this.events.gameFinished(game.value);
    return ok(game.value);
  }
}
