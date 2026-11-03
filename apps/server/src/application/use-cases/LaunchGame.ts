import { err, Game, ok, type Result } from '../../domain';
import { appError, type UseCaseError } from '../errors';
import type { DesignAccess, LaunchedGame, LaunchGameUseCase } from '../ports/in';
import type {
  Clock,
  GameCodeGenerator,
  GameDesignRepository,
  GameRepository,
  IdGenerator,
} from '../ports/out';
import { loadOwnedDesign } from './access';

/** Starts a party from a design: players can join with the code until the host plays a song. */
export class LaunchGame implements LaunchGameUseCase {
  static readonly MAX_CODE_ATTEMPTS = 10;

  constructor(
    private readonly designs: GameDesignRepository,
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly codes: GameCodeGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(access: DesignAccess): Promise<Result<LaunchedGame, UseCaseError>> {
    const design = await loadOwnedDesign(this.designs, access);
    if (!design.ok) return design;

    const code = await this.generateUniqueCode();
    if (!code) {
      return err(appError('CODE_GENERATION_FAILED', 'Could not generate a unique game code'));
    }
    const hostToken = this.ids.next();
    const game = Game.create({
      id: this.ids.next(),
      code,
      hostToken,
      createdAt: this.clock.now(),
      name: design.value.name,
      rounds: design.value.rounds,
    });
    if (!game.ok) return game;
    await this.games.save(game.value);
    return ok({ game: game.value, hostToken });
  }

  private async generateUniqueCode() {
    for (let attempt = 0; attempt < LaunchGame.MAX_CODE_ATTEMPTS; attempt++) {
      const code = this.codes.next();
      if (!(await this.games.findByCode(code))) return code;
    }
    return undefined;
  }
}
