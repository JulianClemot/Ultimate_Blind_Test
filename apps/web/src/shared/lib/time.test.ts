import { describe, expect, it } from 'vitest';

import { formatCountdown, formatElapsed } from './time';

describe('formatElapsed', () => {
  it.each([
    [0, '0.000 s'],
    [1234.56, '1.235 s'],
    [-5, '0.000 s'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0'],
    [4_200, '5'],
    [30_000, '30'],
    [-10, '0'],
  ])('shows %d ms as %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
