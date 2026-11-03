import { ok, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { DeleteGameDesignUseCase, DesignAccess } from '../ports/in';
import type { GameDesignRepository } from '../ports/out';
import { loadOwnedDesign } from './access';

export class DeleteGameDesign implements DeleteGameDesignUseCase {
  constructor(private readonly designs: GameDesignRepository) {}

  async execute(access: DesignAccess): Promise<Result<void, UseCaseError>> {
    const design = await loadOwnedDesign(this.designs, access);
    if (!design.ok) return design;
    await this.designs.delete(design.value.id);
    return ok(undefined);
  }
}
