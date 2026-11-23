import { describe, expect, it } from 'vitest';

import { RoundRules } from '../design/RoundRules';
import type { Answer } from './Answer';
import { eliminatedAfter } from './elimination';

const rules = (eliminationCount: number): RoundRules => {
  const created = RoundRules.create({
    ...RoundRules.preset('last-standing').toProps(),
    eliminationCount,
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
};

const answer = (playerId: string, receivedAt: number, correct = true): Answer => ({
  id: `a-${playerId}`,
  songId: 's1',
  playerId,
  text: 'x',
  receivedAt,
  elapsedMs: receivedAt,
  clientSentAt: receivedAt,
  verdict: { title: correct, artist: false, source: false },
  judgedByHost: false,
  assisted: false,
});

describe('eliminatedAfter', () => {
  it('eliminates the slowest correct answerers, up to the elimination count', () => {
    const out = eliminatedAfter(
      ['a', 'b', 'c', 'd'],
      [answer('a', 100), answer('b', 200), answer('c', 300), answer('d', 400)],
      rules(2),
    );
    expect([...out].sort()).toEqual(['c', 'd']);
  });

  it('eliminates players who did not answer, on top of the slowest ones', () => {
    const out = eliminatedAfter(
      ['a', 'b', 'c', 'd'],
      [answer('a', 100), answer('b', 200), answer('c', 300)],
      rules(1),
    );
    expect([...out].sort()).toEqual(['c', 'd']);
  });

  it('treats a wrong answer like no answer', () => {
    const out = eliminatedAfter(
      ['a', 'b', 'c'],
      [answer('a', 100), answer('b', 50, false), answer('c', 200)],
      rules(1),
    );
    expect([...out].sort()).toEqual(['b', 'c']);
  });

  it('ignores answers from players who are not in the running', () => {
    const out = eliminatedAfter(
      ['a', 'b'],
      [answer('ghost', 10), answer('a', 100), answer('b', 200)],
      rules(1),
    );
    expect([...out]).toEqual(['b']);
  });

  it('never eliminates everybody: the fastest correct player stays', () => {
    const out = eliminatedAfter(['a', 'b', 'c'], [answer('a', 100), answer('b', 200)], rules(5));
    expect([...out].sort()).toEqual(['b', 'c']);
  });

  it('eliminates nobody when nobody found the song', () => {
    const out = eliminatedAfter(['a', 'b'], [answer('a', 100, false)], rules(1));
    expect(out.size).toBe(0);
  });

  it('breaks ties on reception time by arrival order', () => {
    const out = eliminatedAfter(['a', 'b'], [answer('a', 100), answer('b', 100)], rules(1));
    expect([...out]).toEqual(['b']);
  });
});
