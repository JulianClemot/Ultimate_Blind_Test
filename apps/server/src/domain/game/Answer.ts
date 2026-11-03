import type { Verdict } from '../music/answerMatching';
import type { Timestamp } from '../shared/Timestamp';

export interface Answer {
  readonly id: string;
  readonly songId: string;
  readonly playerId: string;
  readonly text: string;
  /** Authoritative server reception time. */
  readonly receivedAt: Timestamp;
  /** Time elapsed since the song started, derived from server timestamps only. */
  readonly elapsedMs: number;
  /** Client-reported send time, informational (client clocks are not trusted). */
  readonly clientSentAt: Timestamp;
  readonly verdict: Verdict;
  /** True once the host overruled the automatic verdict. */
  readonly judgedByHost: boolean;
}
