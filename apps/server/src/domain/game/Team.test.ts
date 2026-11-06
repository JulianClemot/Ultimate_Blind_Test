import { describe, expect, it } from 'vitest';

import { balancedSplit, generateTeamNames, shuffled, type IntSource } from './Team';

/** Deterministic pseudo-random source (LCG) so tests do not flake. */
const seeded = (seed: number): IntSource => {
  let state = seed;
  return {
    nextInt: (max) => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state % max;
    },
  };
};

describe('team helpers', () => {
  describe('balancedSplit', () => {
    it.each([
      [7, 2, [4, 3]],
      [8, 2, [4, 4]],
      [7, 3, [3, 2, 2]],
      [10, 4, [3, 3, 2, 2]],
      [4, 4, [1, 1, 1, 1]],
    ])('splits %i players into %i teams of even sizes', (players, teamCount, expected) => {
      const ids = Array.from({ length: players }, (_, i) => `p${i}`);
      const sizes = balancedSplit(ids, teamCount, seeded(players)).map((team) => team.length);
      expect(sizes).toEqual(expected);
    });

    it('puts every player in exactly one team', () => {
      const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
      const teams = balancedSplit(ids, 3, seeded(5));
      expect(teams.flat().sort()).toEqual([...ids].sort());
    });

    it('shuffles: different seeds give different teams', () => {
      const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
      const first = balancedSplit(ids, 2, seeded(1));
      const others = [2, 3, 4, 5].map((seed) => balancedSplit(ids, 2, seeded(seed)));
      expect(others.some((teams) => JSON.stringify(teams) !== JSON.stringify(first))).toBe(true);
    });

    it('does not mutate its input', () => {
      const ids = ['a', 'b', 'c', 'd'];
      shuffled(ids, seeded(9));
      expect(ids).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('generateTeamNames', () => {
    it('gives distinct names, whatever the draws', () => {
      for (let seed = 0; seed < 50; seed++) {
        const names = generateTeamNames(4, seeded(seed));
        expect(new Set(names).size).toBe(4);
        names.forEach((name) => expect(name).toMatch(/^The \w+ \w+$/));
      }
    });

    it('stays distinct even with a source that always draws 0', () => {
      const names = generateTeamNames(4, { nextInt: () => 0 });
      expect(new Set(names).size).toBe(4);
    });
  });
});
