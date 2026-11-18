import type { Clock, GameRepository } from '../../../application';
import type { Game, GameCode } from '../../../domain';

/**
 * Process-local storage. Fine for a single server instance; swap for a
 * Redis/SQL adapter implementing the same port to scale horizontally.
 */
export class InMemoryGameRepository implements GameRepository {
  private readonly byId = new Map<string, Game>();
  private readonly savedAt = new Map<string, number>();

  /** Every change of a game goes through `save`, so its time is the game's last activity. */
  constructor(private readonly clock: Clock = { now: () => Date.now() }) {}

  save(game: Game): Promise<void> {
    this.byId.set(game.id, game);
    this.savedAt.set(game.id, this.clock.now());
    return Promise.resolve();
  }

  findById(id: string): Promise<Game | undefined> {
    return Promise.resolve(this.byId.get(id));
  }

  findByCode(code: GameCode): Promise<Game | undefined> {
    return Promise.resolve([...this.byId.values()].find((g) => g.code.equals(code)));
  }

  findIdleSince(cutoff: number): Promise<readonly Game[]> {
    return Promise.resolve(
      [...this.byId.values()].filter(
        (game) => game.status !== 'finished' && (this.savedAt.get(game.id) ?? 0) <= cutoff,
      ),
    );
  }
}
