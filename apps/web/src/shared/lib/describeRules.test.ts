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

  it('says how many players win when several can', () => {
    const lines = describeRules({ ...catalog.presets.classic, winnerCount: 3 });
    expect(lines).toContain('The first 3 players to answer correctly score');
    expect(lines.join(' ')).not.toMatch(/fastest/);
  });

  it('lists the points of each place when they go down', () => {
    const podium = { ...catalog.presets.classic, winnerCount: 3, rankStep: 1, titlePoints: 3 };
    expect(describeRules(podium)).toContain('Points by place — title: 3, 2, 1 · artist: 1, 0, 0');
    expect(describeRules({ ...podium, artistPoints: 0 })).toContain('Points by place: 3, 2, 1');
  });

  it('shortens long lists of places', () => {
    const lines = describeRules({
      ...catalog.presets.classic,
      winnerCount: 10,
      rankStep: 1,
      artistPoints: 0,
      titlePoints: 20,
    });
    expect(lines).toContain('Points by place: 20, 19, 18, 17, 16, 15, …');
  });

  it('says nothing about places when every winner gets the same points or only one wins', () => {
    for (const rules of [
      { ...catalog.presets.classic, winnerCount: 3, rankStep: 0 },
      { ...catalog.presets.classic, winnerCount: 1, rankStep: 2 },
      { ...catalog.presets.everyone, winnerCount: 3, rankStep: 1 },
    ]) {
      expect(describeRules(rules).join(' ')).not.toMatch(/by place/);
    }
  });

  it('ignores the number of winners when everyone scores', () => {
    const lines = describeRules({ ...catalog.presets.everyone, winnerCount: 3 });
    expect(lines).toContain('Everyone who answers correctly scores');
    expect(lines.join(' ')).not.toMatch(/first 3/);
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

  it('tells players when a round counts for their team', () => {
    expect(describeRules(catalog.presets.classic)).not.toContain(
      'Team round: the points also count for your team',
    );
    expect(describeRules({ ...catalog.presets.classic, teamMode: true })).toContain(
      'Team round: the points also count for your team',
    );
  });
});

describe('describeRules, easy mode', () => {
  it('tells players about the suggestions and the missing bonus', () => {
    const easy = { ...catalog.presets.classic, easyMode: true };
    expect(describeRules(easy)).toContain(
      'Easy mode: suggestions appear as you type; picking one scores no bonus',
    );
    expect(describeRules(catalog.presets.classic).join()).not.toMatch(/Easy mode/);
  });
});
