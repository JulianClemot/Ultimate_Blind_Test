import { ROUND_PRESETS, type RoundType } from '../../src/domain';
import type { RoundPlanInput } from '../../src/application';

export const unwrap = <T>(
  result: { ok: true; value: T } | { ok: false; error: { message: string } },
): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

export const roundInput = (
  playlist: string,
  type: RoundType = 'classic',
  songCount = ROUND_PRESETS[type].songCount,
): RoundPlanInput => ({
  type,
  playlist,
  name: '',
  playlistTitle: null,
  rules: { ...ROUND_PRESETS[type], songCount },
});
