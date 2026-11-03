import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../../application';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
