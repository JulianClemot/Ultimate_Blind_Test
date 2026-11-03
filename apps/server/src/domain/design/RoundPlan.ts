import type { PlaylistId } from '../music/PlaylistId';
import type { RoundRules, RoundType } from './RoundRules';

export const MAX_ROUND_NAME_LENGTH = 60;

/** One round prepared by the host: a type, its (possibly adjusted) rules and a Deezer playlist. */
export interface RoundPlan {
  /** Name shown to everyone during the game. May be empty: clients then show the round type. */
  readonly name: string;
  readonly type: RoundType;
  readonly playlist: PlaylistId;
  /** Display label remembered from the playlist check, if any. */
  readonly playlistTitle: string | null;
  readonly rules: RoundRules;
}
