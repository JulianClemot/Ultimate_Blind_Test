import type { Game, Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { AttachHostUseCase, HostCommand } from '../ports/in';
import type { GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Lets the host (re)connect to a game it launched and get its current state. */
export class AttachHost implements AttachHostUseCase {
  constructor(private readonly games: GameRepository) {}

  execute(command: HostCommand): Promise<Result<Game, UseCaseError>> {
    return loadHostedGame(this.games, command);
  }
}
