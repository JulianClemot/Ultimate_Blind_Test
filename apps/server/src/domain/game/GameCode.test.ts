import { describe, expect, it } from 'vitest';

import { GameCode } from './GameCode';

describe('GameCode', () => {
  it('normalizes case and surrounding spaces', () => {
    const code = GameCode.create('  abcdef ');
    expect(code.ok && code.value.value).toBe('ABCDEF');
  });

  it.each(['ABC', 'ABCDEFG', 'ABCDE0', 'ABCDEI'])('rejects "%s"', (raw) => {
    const code = GameCode.create(raw);
    expect(!code.ok && code.error.code).toBe('INVALID_GAME_CODE');
  });
});
