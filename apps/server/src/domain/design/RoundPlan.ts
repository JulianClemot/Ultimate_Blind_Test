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
  /**
   * Corrections of the host to the film or series found for a track (by track id): a name, or
   * null when the track is not from a film or series and must not be played in this round.
   */
  readonly sourceOverrides: Readonly<Record<string, string | null>>;
}
