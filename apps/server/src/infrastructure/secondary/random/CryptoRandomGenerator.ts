import { randomInt } from 'node:crypto';

import type { RandomGenerator } from '../../../application';

export class CryptoRandomGenerator implements RandomGenerator {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}
