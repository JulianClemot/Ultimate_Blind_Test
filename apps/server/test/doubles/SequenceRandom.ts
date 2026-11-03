import type { RandomGenerator } from '../../src/application';

/** Returns the given values in order (modulo the bound), repeating the last one. */
export class SequenceRandom implements RandomGenerator {
  private index = 0;

  constructor(private readonly values: readonly number[] = [0]) {}

  nextInt(maxExclusive: number): number {
    const value = this.values[Math.min(this.index++, this.values.length - 1)] ?? 0;
    return value % maxExclusive;
  }
}
