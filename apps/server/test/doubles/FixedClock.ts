import type { Clock } from '../../src/application';

export class FixedClock implements Clock {
  constructor(private current = 1_700_000_000_000) {}

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
