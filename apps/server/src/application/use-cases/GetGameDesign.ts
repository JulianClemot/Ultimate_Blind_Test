import type { GameDesign, Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { DesignAccess, GetGameDesignUseCase } from '../ports/in';
import type { GameDesignRepository } from '../ports/out';
import { loadOwnedDesign } from './access';

export class GetGameDesign implements GetGameDesignUseCase {
  constructor(private readonly designs: GameDesignRepository) {}

  execute(access: DesignAccess): Promise<Result<GameDesign, UseCaseError>> {
    return loadOwnedDesign(this.designs, access);
  }
}
