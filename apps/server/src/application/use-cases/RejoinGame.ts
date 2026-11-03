import { err, gameError, ok, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type { PlayerSession, RejoinGameCommand, RejoinGameUseCase } from '../ports/in';
import type { GameRepository } from '../ports/out';

/** Restores a player session after a reconnection (phone sleep, network switch…). */
export class RejoinGame implements RejoinGameUseCase {
  constructor(private readonly games: GameRepository) {}

  async execute({
    gameId,
    playerId,
  }: RejoinGameCommand): Promise<Result<PlayerSession, UseCaseError>> {
    const game = await this.games.findById(gameId);
    if (!game) return err(gameNotFound());
    const player = game.findPlayer(playerId);
    if (!player) return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    return ok({ game, player });
  }
}
