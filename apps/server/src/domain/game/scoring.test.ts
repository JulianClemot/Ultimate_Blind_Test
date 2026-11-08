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
  verdict: { title, artist, source: false },
  judgedByHost: false,
  assisted: false,
});

const assisted = (playerId: string, elapsedMs: number, title: boolean, artist: boolean) => ({
  ...answer(playerId, elapsedMs, title, artist),
  assisted: true,
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

  it('"first" with a rank step: each place pays less than the previous one', () => {
    const podium = rules({
      scoring: 'first',
      winnerCount: 3,
      rankStep: 1,
      titlePoints: 3,
      artistPoints: 2,
    });
    const result = scoreSong(podium, [
      answer('alice', 1_000, true, true),
      answer('bob', 2_000, true, true),
      answer('carol', 3_000, true, false),
      answer('dave', 4_000, true, true),
    ]);
    // Title: alice 3, bob 2, carol 1 (dave has no place left).
    // Artist: alice 2, bob 1, then dave takes the 3rd place, worth 0 (carol did not find it).
    expect(scores(result)).toEqual({ alice: 5, bob: 3, carol: 1, dave: 0 });
  });

  it('"first": points never go below zero, and a step of zero keeps them equal', () => {
    const steep = rules({
      scoring: 'first',
      winnerCount: 3,
      rankStep: 2,
      titlePoints: 3,
      artistPoints: 0,
    });
    const answers = [
      answer('alice', 1_000, true, false),
      answer('bob', 2_000, true, false),
      answer('carol', 3_000, true, false),
    ];
    expect(scores(scoreSong(steep, answers))).toEqual({ alice: 3, bob: 1, carol: 0 });

    const flat = rules({
      scoring: 'first',
      winnerCount: 3,
      rankStep: 0,
      titlePoints: 3,
      artistPoints: 0,
    });
    expect(scores(scoreSong(flat, answers))).toEqual({ alice: 3, bob: 3, carol: 3 });
  });

  it('"first": the speed bonus and the both-bonus are not reduced by rank', () => {
    const podium = rules({
      scoring: 'first',
      winnerCount: 2,
      rankStep: 1,
      titlePoints: 2,
      artistPoints: 2,
      bothBonus: 4,
      speedBonus: 10,
      answerTimeSec: 10,
    });
    const result = scoreSong(podium, [
      answer('alice', 0, true, true),
      answer('bob', 5_000, true, true),
    ]);
    // alice: (2+10) + (2+10) + 4. bob: (1+5) + (1+5) + 4.
    expect(scores(result)).toEqual({ alice: 28, bob: 16 });
  });

  it('"everyone" ignores the rank step too', () => {
    const everyone = rules({ scoring: 'everyone', rankStep: 1, artistPoints: 0 });
    const result = scoreSong(everyone, [
      answer('alice', 1_000, true, false),
      answer('bob', 2_000, true, false),
    ]);
    expect(scores(result)).toEqual({ alice: 1, bob: 1 });
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

  describe('assisted answers (picked from the suggestions of an easy round)', () => {
    const bonuses = rules({
      scoring: 'everyone',
      titlePoints: 2,
      artistPoints: 2,
      bothBonus: 4,
      speedBonus: 10,
      answerTimeSec: 10,
    });

    it('score the points of both parts, without the speed or the both-parts bonus', () => {
      const result = scoreSong(bonuses, [
        answer('alice', 0, true, true),
        assisted('bob', 0, true, true),
      ]);
      // alice: (2+10) + (2+10) + 4. bob: 2 + 2.
      expect(scores(result)).toEqual({ alice: 28, bob: 4 });
    });

    it('still score only what the picked suggestion got right', () => {
      const result = scoreSong(bonuses, [assisted('bob', 0, false, true)]);
      expect(scores(result)).toEqual({ bob: 2 });
    });

    it('compete for places like any other answer', () => {
      const first = rules({ scoring: 'first', titlePoints: 3, artistPoints: 0 });
      const result = scoreSong(first, [
        assisted('bob', 1_000, true, false),
        answer('alice', 2_000, true, false),
      ]);
      expect(scores(result)).toEqual({ bob: 3 });
    });
  });

  describe('rounds about films and series', () => {
    const screen = rules({ titlePoints: 0, artistPoints: 0, sourcePoints: 3 });
    const found = (playerId: string, elapsedMs: number): Answer => ({
      ...answer(playerId, elapsedMs, false, false),
      verdict: { title: false, artist: false, source: true },
    });

    it('rewards the film or series only', () => {
      const result = scoreSong(screen, [answer('bob', 1_000, true, true), found('alice', 2_000)]);
      expect(scores(result)).toEqual({ alice: 3 });
    });

    it('gives no both-parts bonus for a single part', () => {
      const bonus = rules({ titlePoints: 0, artistPoints: 0, sourcePoints: 3, bothBonus: 5 });
      expect(scores(scoreSong(bonus, [found('alice', 1_000)]))).toEqual({ alice: 3 });
    });
  });
});
