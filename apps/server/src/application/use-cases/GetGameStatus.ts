import { err, gameError, ok, type Game, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type { GetGameStatusCommand, GetGameStatusUseCase } from '../ports/in';
import type { GameRepository } from '../ports/out';

/**
 * Tells a player whether their party is still on, without opening a session: lets the home
 * page flag finished or vanished games. Like `RejoinGame`, the player id is the credential.
 */
export class GetGameStatus implements GetGameStatusUseCase {
  constructor(private readonly games: GameRepository) {}

  async execute({
    gameId,
    playerId,
  }: GetGameStatusCommand): Promise<Result<Game['status'], UseCaseError>> {
    const game = await this.games.findById(gameId);
    if (!game) return err(gameNotFound());
    if (!game.findPlayer(playerId)) {
      return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    }
    return ok(game.status);
  }
}
