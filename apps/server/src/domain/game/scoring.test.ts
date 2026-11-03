import { describe, expect, it } from 'vitest';

import { ROUND_PRESETS, RoundRules, type RoundRulesProps } from '../design/RoundRules';
import type { Answer } from './Answer';
import { scoreSong } from './scoring';

const rules = (overrides: Partial<RoundRulesProps>) => {
  const result = RoundRules.create({ ...ROUND_PRESETS.classic, ...overrides });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const answer = (playerId: string, elapsedMs: number, title: boolean, artist: boolean): Answer => ({
  id: `${playerId}-${elapsedMs}`,
  songId: 's1',
  playerId,
  text: '…',
  receivedAt: 1_000 + elapsedMs,
  elapsedMs,
  clientSentAt: 0,
  verdict: { title, artist },
  judgedByHost: false,
});

const scores = (map: ReadonlyMap<string, number>) => Object.fromEntries(map);

describe('scoreSong', () => {
  it('"first": the fastest correct player takes each part', () => {
    const first = rules({ scoring: 'first', titlePoints: 2, artistPoints: 1 });
    const result = scoreSong(first, [
      answer('bob', 3_000, true, false),
      answer('alice', 1_000, false, true),
      answer('carol', 2_000, true, true),
    ]);
    expect(scores(result)).toEqual({ alice: 1, carol: 2 });
  });

  it('"first" with several winners: the first N correct players each take the points', () => {
    const topTwo = rules({ scoring: 'first', winnerCount: 2, titlePoints: 3, artistPoints: 1 });
    const result = scoreSong(topTwo, [
      answer('dave', 4_000, true, true),
      answer('bob', 3_000, true, false),
      answer('alice', 1_000, true, true),
      answer('carol', 2_000, false, true),
    ]);
    // Title: alice then bob. Artist: alice then carol. Dave is too late for both.
    expect(scores(result)).toEqual({ alice: 4, bob: 3, carol: 1 });
  });

  it('"first": winners are counted per player, and wrong or repeated answers do not use a place', () => {
    const topTwo = rules({ scoring: 'first', winnerCount: 2, artistPoints: 0 });
    const result = scoreSong(topTwo, [
      answer('alice', 1_000, true, false),
      answer('alice', 1_500, true, false),
      answer('bob', 2_000, false, false),
      answer('carol', 3_000, true, false),
      answer('dave', 4_000, true, false),
    ]);
    expect(scores(result)).toEqual({ alice: 1, carol: 1 });
  });

  it('"first": winners get the speed bonus of their own answer', () => {
    const topTwo = rules({
      scoring: 'first',
      winnerCount: 2,
      speedBonus: 10,
      answerTimeSec: 10,
      artistPoints: 0,
    });
    const result = scoreSong(topTwo, [
      answer('alice', 0, true, false),
      answer('bob', 5_000, true, false),
    ]);
    expect(scores(result)).toEqual({ alice: 11, bob: 6 });
  });

  it('"everyone" ignores the number of winners', () => {
    const everyone = rules({ scoring: 'everyone', winnerCount: 1, artistPoints: 0 });
    const result = scoreSong(everyone, [
      answer('alice', 1_000, true, false),
      answer('bob', 2_000, true, false),
    ]);
    expect(scores(result)).toEqual({ alice: 1, bob: 1 });
  });

  it('"first": the both-bonus needs the same player to win both parts', () => {
    const first = rules({ scoring: 'first', bothBonus: 5 });
    expect(scores(scoreSong(first, [answer('alice', 1_000, true, true)]))).toEqual({ alice: 7 });
    expect(
      scores(
        scoreSong(first, [answer('alice', 1_000, true, false), answer('bob', 2_000, true, true)]),
      ),
    ).toEqual({ alice: 1, bob: 1 });
  });

  it('"everyone": every correct player scores, with a speed bonus', () => {
    const everyone = rules({
      scoring: 'everyone',
      titlePoints: 2,
      artistPoints: 2,
      bothBonus: 1,
      speedBonus: 10,
      answerTimeSec: 10,
    });
    const result = scoreSong(everyone, [
      answer('alice', 0, true, true), // 2+10 + 2+10 + 1
      answer('bob', 5_000, true, false), // 2+5
      answer('bob', 9_000, true, true), // artist: 2+1, title already counted, +1 both
      answer('carol', 10_000, false, false),
    ]);
    expect(scores(result)).toEqual({ alice: 25, bob: 11 });
  });

  it('counts a part once per player even if found several times', () => {
    const everyone = rules({ scoring: 'everyone' });
    const result = scoreSong(everyone, [
      answer('alice', 1_000, true, false),
      answer('alice', 2_000, true, false),
    ]);
    expect(scores(result)).toEqual({ alice: 1 });
  });

  it('ignores parts that are not asked', () => {
    const titleOnly = rules({ artistPoints: 0, bothBonus: 5 });
    expect(scores(scoreSong(titleOnly, [answer('alice', 0, true, true)]))).toEqual({ alice: 1 });
  });
});
