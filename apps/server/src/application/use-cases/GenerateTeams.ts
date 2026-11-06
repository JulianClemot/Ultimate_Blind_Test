import { ok, type Game, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { GenerateTeamsCommand, GenerateTeamsUseCase } from '../ports/in';
import type { GameEventPublisher, GameRepository, RandomGenerator } from '../ports/out';
import { loadHostedGame } from './access';

/**
 * Right before the party: shuffles the players into balanced teams with generated names.
 * The host can redo it until the first song, and latecomers join the smallest team.
 */
export class GenerateTeams implements GenerateTeamsUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly random: RandomGenerator,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: GenerateTeamsCommand): Promise<Result<Game, UseCaseError>> {
    const loaded = await loadHostedGame(this.games, command);
    if (!loaded.ok) return loaded;
    const game = loaded.value;

    const teams = game.generateTeams({ teamCount: command.teamCount, random: this.random });
    if (!teams.ok) return teams;

    await this.games.save(game);
    this.events.teamsUpdated(game);
    return ok(game);
  }
}
