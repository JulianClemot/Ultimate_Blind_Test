import { describe, expect, it } from 'vitest';

import { PlayerName } from './PlayerName';

const name = (raw: string) => {
  const result = PlayerName.create(raw);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('PlayerName', () => {
  it('trims and collapses whitespace', () => {
    expect(name('  Freddie   Mercury ').value).toBe('Freddie Mercury');
  });

  it.each(['', '   ', 'x'.repeat(PlayerName.MAX_LENGTH + 1)])('rejects "%s"', (raw) => {
    const result = PlayerName.create(raw);
    expect(!result.ok && result.error.code).toBe('INVALID_PLAYER_NAME');
  });

  it('compares names case-insensitively', () => {
    expect(name('Alice').sameAs(name('aLiCe'))).toBe(true);
    expect(name('Alice').sameAs(name('Bob'))).toBe(false);
  });
});
