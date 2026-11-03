import type { GameRepository } from '../../../application';
import type { Game, GameCode } from '../../../domain';

/**
 * Process-local storage. Fine for a single server instance; swap for a
 * Redis/SQL adapter implementing the same port to scale horizontally.
 */
export class InMemoryGameRepository implements GameRepository {
  private readonly byId = new Map<string, Game>();

  save(game: Game): Promise<void> {
    this.byId.set(game.id, game);
    return Promise.resolve();
  }

  findById(id: string): Promise<Game | undefined> {
    return Promise.resolve(this.byId.get(id));
  }

  findByCode(code: GameCode): Promise<Game | undefined> {
    return Promise.resolve([...this.byId.values()].find((g) => g.code.equals(code)));
  }
}
