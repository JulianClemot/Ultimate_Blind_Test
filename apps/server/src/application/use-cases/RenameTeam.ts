import { ok, type Game, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { RenameTeamCommand, RenameTeamUseCase } from '../ports/in';
import type { GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Lobby only: the host replaces a generated team name with one of their own. */
export class RenameTeam implements RenameTeamUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: RenameTeamCommand): Promise<Result<Game, UseCaseError>> {
    const loaded = await loadHostedGame(this.games, command);
    if (!loaded.ok) return loaded;
    const game = loaded.value;

    const renamed = game.renameTeam({ teamId: command.teamId, name: command.name });
    if (!renamed.ok) return renamed;

    await this.games.save(game);
    this.events.teamsUpdated(game);
    return ok(game);
  }
}
