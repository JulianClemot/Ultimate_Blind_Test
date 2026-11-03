import type { Timestamp } from '../../../domain';

export interface Clock {
  /** Current time as epoch ms, with sub-millisecond precision when available. */
  now(): Timestamp;
}
