export interface RandomGenerator {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}
