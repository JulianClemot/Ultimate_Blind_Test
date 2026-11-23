import type { EliminationDto } from '@ubt/shared';
import { describe, expect, it } from 'vitest';

import { hostSong, snapshot } from '@/test/fixtures';

import { hostGameReducer } from './hostGameState';

const alice = { id: 'p1', name: 'Alice' };
const bob = { id: 'p2', name: 'Bob' };

const elimination = (overrides: Partial<EliminationDto> = {}): EliminationDto => ({
  roundNumber: 2,
  remaining: [alice, bob],
  eliminated: [],
  leftAfterCurrentSong: [],
  ...overrides,
});

const reveal = (e: EliminationDto) => ({
  songId: 's1',
  title: 'T',
  artist: 'A',
  source: null,
  scoreboard: [],
  teamScoreboard: [],
  elimination: e,
});

// Round 2 is the last of the two rounds of the fixture.
const standing = snapshot({
  status: 'playing',
  currentSong: hostSong({ roundNumber: 2, roundType: 'last-standing', songCount: 50 }),
  elimination: elimination(),
});

describe('hostGameReducer in a last-standing round', () => {
  it('takes who is in the running from each new song', () => {
    const next = hostGameReducer(standing, {
      type: 'songStarted',
      song: hostSong({
        id: 's2',
        roundNumber: 2,
        elimination: elimination({ remaining: [alice] }),
      }),
    });
    expect(next?.elimination?.remaining).toEqual([alice]);
  });

  it('shows who left with the reveal', () => {
    const left = elimination({ remaining: [alice, bob], eliminated: [], leftAfterCurrentSong: [] });
    const state = hostGameReducer(standing, {
      type: 'songRevealed',
      reveal: reveal({ ...left, remaining: [alice, bob] }),
    });
    expect(state?.elimination?.remaining).toEqual([alice, bob]);
    expect(state?.hasNextSong).toBe(true);
  });

  it('offers to show the final scores once the last round is won', () => {
    const won = elimination({ remaining: [alice], eliminated: [bob], leftAfterCurrentSong: [bob] });
    const state = hostGameReducer(standing, { type: 'songRevealed', reveal: reveal(won) });
    expect(state?.hasNextSong).toBe(false);
  });

  it('keeps going after a won round that is not the last one', () => {
    const state = hostGameReducer(
      { ...standing, rounds: [...standing.rounds, ...standing.rounds] },
      {
        type: 'songRevealed',
        reveal: reveal(elimination({ remaining: [alice], eliminated: [bob] })),
      },
    );
    expect(state?.hasNextSong).toBe(true);
  });

  it('follows a correction of the host after the reveal', () => {
    const won = hostGameReducer(standing, {
      type: 'songRevealed',
      reveal: reveal(elimination({ remaining: [alice], eliminated: [bob] })),
    });
    const corrected = hostGameReducer(won, {
      type: 'eliminationUpdated',
      elimination: elimination({ remaining: [alice, bob] }),
    });
    expect(corrected).toMatchObject({
      hasNextSong: true,
      elimination: { remaining: [alice, bob] },
    });
  });
});
