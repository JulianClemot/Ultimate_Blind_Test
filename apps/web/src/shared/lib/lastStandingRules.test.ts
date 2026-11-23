import { describe, expect, it } from 'vitest';

import { catalog } from '@/test/fixtures';

import { describeRules } from './describeRules';

describe('describeRules of a last-standing round', () => {
  it('has no song count: it ends when one player is left', () => {
    const lines = describeRules(catalog.presets['last-standing'], 'last-standing');
    expect(lines[0]).toBe(
      'Last player standing: 20 s to answer each song, as many songs as it takes',
    );
    expect(lines.join(' ')).not.toMatch(/\d+ songs,/);
    expect(lines).toContain('After each song, the slowest correct answer is out');
    expect(lines).toContain('Anyone who finds nothing is out too, and the last player in wins');
  });

  it('counts the players out after each song', () => {
    const lines = describeRules(
      { ...catalog.presets['last-standing'], eliminationCount: 3 },
      'last-standing',
    );
    expect(lines).toContain('After each song, the 3 slowest correct answers are out');
  });
});
