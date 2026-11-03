import {
  err,
  gameError,
  MAX_ROUND_NAME_LENGTH,
  ok,
  RoundRules,
  type GameDesign,
  type Result,
  type RoundPlan,
} from '../../domain';
import type { UseCaseError } from '../errors';
import type { RoundPlanInput, UpdateGameDesignCommand, UpdateGameDesignUseCase } from '../ports/in';
import type { Clock, GameDesignRepository, MusicCatalog } from '../ports/out';
import { loadOwnedDesign } from './access';
import { resolvePlaylistId } from './resolvePlaylistId';

const blankToNull = (text: string | null): string | null => {
  const trimmed = text?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const toPlan = async (
  catalog: MusicCatalog,
  input: RoundPlanInput,
  index: number,
): Promise<Result<RoundPlan, UseCaseError>> => {
  // Share links are saved as the playlist they point to, so the design never depends on them.
  const playlist = await resolvePlaylistId(catalog, input.playlist);
  if (!playlist.ok) {
    return err({ ...playlist.error, message: `Round ${index + 1}: ${playlist.error.message}` });
  }
  const rules = RoundRules.create(input.rules);
  if (!rules.ok) {
    return err(gameError('INVALID_ROUND_RULES', `Round ${index + 1}: ${rules.error.message}`));
  }
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length > MAX_ROUND_NAME_LENGTH) {
    return err(
      gameError(
        'INVALID_ROUND_NAME',
        `Round ${index + 1}: name must be at most ${MAX_ROUND_NAME_LENGTH} characters`,
      ),
    );
  }
  return ok({
    name,
    type: input.type,
    playlist: playlist.value,
    playlistTitle: blankToNull(input.playlistTitle),
    rules: rules.value,
  });
};

export class UpdateGameDesign implements UpdateGameDesignUseCase {
  constructor(
    private readonly designs: GameDesignRepository,
    private readonly clock: Clock,
    private readonly catalog: MusicCatalog,
  ) {}

  async execute(command: UpdateGameDesignCommand): Promise<Result<GameDesign, UseCaseError>> {
    const design = await loadOwnedDesign(this.designs, command);
    if (!design.ok) return design;

    const rounds: RoundPlan[] = [];
    for (const [index, input] of command.rounds.entries()) {
      const plan = await toPlan(this.catalog, input, index);
      if (!plan.ok) return plan;
      rounds.push(plan.value);
    }

    const updated = design.value.update({
      name: command.name,
      rounds,
      updatedAt: this.clock.now(),
    });
    if (!updated.ok) return updated;
    await this.designs.save(design.value);
    return ok(design.value);
  }
}
