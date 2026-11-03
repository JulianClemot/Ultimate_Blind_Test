import type { GameCodeGenerator } from '../../src/application';
import { GameCode } from '../../src/domain';

/** Returns the given codes in order, repeating the last one. */
export class StubGameCodeGenerator implements GameCodeGenerator {
  private index = 0;

  constructor(private readonly codes: readonly string[] = ['ABCDEF']) {}

  next(): GameCode {
    const raw = this.codes[Math.min(this.index++, this.codes.length - 1)] ?? 'ABCDEF';
    const code = GameCode.create(raw);
    if (!code.ok) throw new Error(`Invalid stub code ${raw}`);
    return code.value;
  }
}
