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
    { songCount: 2.5 },
    { answerTimeSec: 500 },
    { excerptSec: 0 },
    { playbackRate: 3 },
    { titlePoints: 0, artistPoints: 0 },
    { scoring: 'random' as 'first' },
  ])('rejects %o', (override) => {
    const result = RoundRules.create({ ...ROUND_PRESETS.classic, ...override });
    expect(!result.ok && result.error.code).toBe('INVALID_ROUND_RULES');
  });

  it('only asks for parts that earn points', () => {
    const titleOnly = RoundRules.create({ ...ROUND_PRESETS.classic, artistPoints: 0 });
    expect(titleOnly.ok && [titleOnly.value.asks('title'), titleOnly.value.asks('artist')]).toEqual(
      [true, false],
    );
  });
});
