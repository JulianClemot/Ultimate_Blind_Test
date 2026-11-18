import { ok, type Game, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { MovePlayersCommand, MovePlayersUseCase } from '../ports/in';
import type { GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** Lobby only: the host overrides the draw by putting players in another team. */
export class MovePlayers implements MovePlayersUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: MovePlayersCommand): Promise<Result<Game, UseCaseError>> {
    const loaded = await loadHostedGame(this.games, command);
    if (!loaded.ok) return loaded;
    const game = loaded.value;

    const moved = game.movePlayers({ playerIds: command.playerIds, teamId: command.teamId });
    if (!moved.ok) return moved;

    await this.games.save(game);
    this.events.teamsUpdated(game);
    return ok(game);
  }
}
