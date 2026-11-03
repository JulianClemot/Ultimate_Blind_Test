import { performance } from 'node:perf_hooks';

import type { Clock } from '../../../application';

/**
 * Monotonic high-resolution clock anchored on the process start epoch:
 * immune to wall-clock adjustments (NTP jumps) during a game.
 */
export class SystemClock implements Clock {
  now(): number {
    return performance.timeOrigin + performance.now();
  }
}
