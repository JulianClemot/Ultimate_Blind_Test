import type { GameDesign } from '../../../domain';

export interface GameDesignRepository {
  save(design: GameDesign): Promise<void>;
  findById(id: string): Promise<GameDesign | undefined>;
  delete(id: string): Promise<void>;
}
