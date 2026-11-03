import { randomInt } from 'node:crypto';

import type { GameCodeGenerator } from '../../../application';
import { GameCode } from '../../../domain';

export class RandomGameCodeGenerator implements GameCodeGenerator {
  next(): GameCode {
    const raw = Array.from(
      { length: GameCode.LENGTH },
      () => GameCode.ALPHABET[randomInt(GameCode.ALPHABET.length)],
    ).join('');
    const code = GameCode.create(raw);
    if (!code.ok) throw new Error(`Generated an invalid game code: ${raw}`);
    return code.value;
  }
}
