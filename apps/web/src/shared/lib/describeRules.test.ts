import { describe, expect, it } from 'vitest';

import { catalog } from '@/test/fixtures';

import { describeRules } from './describeRules';

describe('describeRules', () => {
  it('describes a classic round', () => {
    expect(describeRules(catalog.presets.classic)).toEqual([
      '10 songs, 30 s to answer each',
      'Find the title (1 point) and the artist (1 point)',
      'Only the fastest correct answer scores',
    ]);
  });

  it('mentions bonuses for rounds where everyone scores', () => {
    expect(describeRules({ ...catalog.presets.everyone, bothBonus: 1 })).toEqual([
      '10 songs, 30 s to answer each',
      'Find the title (2 points) and the artist (2 points)',
      'Everyone who answers correctly scores',
      'Bonus: +1 point for finding both',
      'Speed bonus: up to +3 points for quick answers',
    ]);
  });

  it('mentions short excerpts and faster playback', () => {
    expect(describeRules(catalog.presets.flash)).toContain(
      'Only the first 4 s of each song are played',
    );
    expect(describeRules(catalog.presets['fast-forward'])).toContain(
      'Songs are played at ×2 speed',
    );
  });

  it('only asks for the parts that earn points, in the singular', () => {
    const lines = describeRules({
      ...catalog.presets.classic,
      songCount: 1,
      artistPoints: 0,
      bothBonus: 5,
    });
    expect(lines[0]).toBe('1 song, 30 s to answer each');
    expect(lines[1]).toBe('Find the title (1 point)');
    expect(lines.join(' ')).not.toMatch(/Bonus/);
  });
});
