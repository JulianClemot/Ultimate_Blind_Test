import { GameDesign, ok, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type {
  CreateGameDesignCommand,
  CreateGameDesignUseCase,
  CreatedGameDesign,
} from '../ports/in';
import type { Clock, GameDesignRepository, IdGenerator } from '../ports/out';

export class CreateGameDesign implements CreateGameDesignUseCase {
  constructor(
    private readonly designs: GameDesignRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({
    name,
  }: CreateGameDesignCommand): Promise<Result<CreatedGameDesign, UseCaseError>> {
    const editToken = this.ids.next();
    const design = GameDesign.create({
      id: this.ids.next(),
      editToken,
      name,
      createdAt: this.clock.now(),
    });
    if (!design.ok) return design;
    await this.designs.save(design.value);
    return ok({ design: design.value, editToken });
  }
}
