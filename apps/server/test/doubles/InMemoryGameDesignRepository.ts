import type { GameDesignRepository } from '../../src/application';
import { GameDesign } from '../../src/domain';

/** Stores snapshots, like a real database would, so tests catch aliasing bugs. */
export class InMemoryGameDesignRepository implements GameDesignRepository {
  private readonly snapshots = new Map<string, ReturnType<GameDesign['toSnapshot']>>();

  save(design: GameDesign): Promise<void> {
    this.snapshots.set(design.id, structuredClone(design.toSnapshot()));
    return Promise.resolve();
  }

  findById(id: string): Promise<GameDesign | undefined> {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? GameDesign.restore(structuredClone(snapshot)) : undefined);
  }

  delete(id: string): Promise<void> {
    this.snapshots.delete(id);
    return Promise.resolve();
  }
}
