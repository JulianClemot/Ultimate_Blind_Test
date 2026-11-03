import type { Game, GameCode } from '../../../domain';

export interface GameRepository {
  save(game: Game): Promise<void>;
  findById(id: string): Promise<Game | undefined>;
  findByCode(code: GameCode): Promise<Game | undefined>;
}
