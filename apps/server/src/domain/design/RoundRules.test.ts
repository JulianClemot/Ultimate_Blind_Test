import { describe, expect, it } from 'vitest';

import { ROUND_PRESETS, ROUND_TYPES, RoundRules } from './RoundRules';

describe('RoundRules', () => {
  it.each(ROUND_TYPES)('accepts the %s preset', (type) => {
    expect(RoundRules.preset(type).toProps()).toEqual(ROUND_PRESETS[type]);
  });

  it('lets the host adjust a preset', () => {
    const result = RoundRules.create({ ...ROUND_PRESETS.classic, songCount: 3, titlePoints: 5 });
    expect(result.ok && result.value.songCount).toBe(3);
  });

  it.each([
    { songCount: 0 },
    { winnerCount: 0 },
    { winnerCount: 51 },
    { winnerCount: 1.5 },
    { rankStep: -1 },
    { rankStep: 101 },
    { rankStep: 0.5 },
    { songCount: 2.5 },
    { answerTimeSec: 500 },
    { excerptSec: 0 },
    { playbackRate: 3 },
    { titlePoints: 0, artistPoints: 0 },
    { scoring: 'random' as 'first' },
    { teamMode: 'yes' as unknown as boolean },
    { easyMode: 'yes' as unknown as boolean },
  ])('rejects %o', (override) => {
    const result = RoundRules.create({ ...ROUND_PRESETS.classic, ...override });
    expect(!result.ok && result.error.code).toBe('INVALID_ROUND_RULES');
  });

  it('is not played in team mode by default, but the host can turn it on', () => {
    expect(RoundRules.preset('classic').teamMode).toBe(false);
    const result = RoundRules.create({ ...ROUND_PRESETS.classic, teamMode: true });
    expect(result.ok && result.value.toProps().teamMode).toBe(true);
  });

  it('keeps the number of winners the host chose', () => {
    const result = RoundRules.create({ ...ROUND_PRESETS.classic, winnerCount: 3 });
    expect(result.ok && result.value.toProps().winnerCount).toBe(3);
  });

  it('gives the points of each place', () => {
    const result = RoundRules.create({
      ...ROUND_PRESETS.classic,
      winnerCount: 4,
      titlePoints: 3,
      rankStep: 1,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect([0, 1, 2, 3].map((rank) => result.value.pointsForRank('title', rank))).toEqual([
      3, 2, 1, 0,
    ]);
    expect(result.value.pointsForRank('title', 9)).toBe(0);
  });

  it('only asks for parts that earn points', () => {
    const titleOnly = RoundRules.create({ ...ROUND_PRESETS.classic, artistPoints: 0 });
    expect(titleOnly.ok && [titleOnly.value.asks('title'), titleOnly.value.asks('artist')]).toEqual(
      [true, false],
    );
  });
});
