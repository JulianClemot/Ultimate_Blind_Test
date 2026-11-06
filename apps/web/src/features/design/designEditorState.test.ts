import type { GameDesignDto } from '@ubt/shared';
import { describe, expect, it } from 'vitest';

import { catalog } from '@/test/fixtures';

import {
  designEditorReducer,
  emptyEditor,
  roundWarnings,
  toUpdatePayload,
  totalSongs,
  type EditorAction,
  type EditorState,
} from './designEditorState';

const design: GameDesignDto = {
  id: 'd1',
  name: 'Friday night',
  rounds: [
    {
      name: 'My 80s',
      type: 'classic',
      playlist: '42',
      playlistTitle: '80s',
      rules: catalog.presets.classic,
    },
  ],
  updatedAt: 1,
};

const run = (...actions: EditorAction[]): EditorState =>
  actions.reduce(designEditorReducer, emptyEditor);

const add = (key: string, roundType: 'classic' | 'flash' = 'classic'): EditorAction => ({
  type: 'roundAdded',
  key,
  roundType,
  catalog,
});

describe('designEditorReducer', () => {
  it('loads a saved design as clean', () => {
    const state = run({ type: 'loaded', design });
    expect(state).toMatchObject({ name: 'Friday night', dirty: false });
    expect(state.rounds[0]).toMatchObject({
      playlist: '42',
      playlistTitle: '80s',
      playableTracks: null,
    });
  });

  it('adds rounds from presets, reusing the previous playlist, up to the limit', () => {
    const state = run({ type: 'loaded', design }, add('r2', 'flash'), add('r3'), add('r4'));
    expect(state.rounds.map((r) => [r.type, r.playlist])).toEqual([
      ['classic', '42'],
      ['flash', '42'],
      ['classic', '42'],
    ]);
    expect(state.rounds[1]?.rules).toEqual(catalog.presets.flash);
    expect(state.dirty).toBe(true);
  });

  it('moves and removes rounds', () => {
    const state = run(add('a'), add('b'), add('c'), { type: 'roundMoved', key: 'c', offset: -1 });
    expect(state.rounds.map((r) => r.key)).toEqual(['a', 'c', 'b']);
    expect(designEditorReducer(state, { type: 'roundMoved', key: 'a', offset: -1 })).toBe(state);
    const removed = designEditorReducer(state, { type: 'roundRemoved', key: 'c' });
    expect(removed.rounds.map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('resets rules to the new preset when the type changes, keeping the song count', () => {
    const state = run(
      add('a'),
      { type: 'ruleChanged', key: 'a', rule: 'songCount', value: 5 },
      { type: 'ruleChanged', key: 'a', rule: 'titlePoints', value: 9 },
      { type: 'roundTypeChanged', key: 'a', roundType: 'flash', catalog },
    );
    expect(state.rounds[0]?.rules).toEqual({ ...catalog.presets.flash, songCount: 5 });
  });

  it('adjusts individual rules', () => {
    const state = run(
      add('a'),
      { type: 'scoringChanged', key: 'a', scoring: 'everyone' },
      { type: 'playbackRateChanged', key: 'a', rate: 1.5 },
      { type: 'ruleChanged', key: 'a', rule: 'speedBonus', value: 4 },
    );
    expect(state.rounds[0]?.rules).toMatchObject({
      scoring: 'everyone',
      playbackRate: 1.5,
      speedBonus: 4,
    });
  });

  it('records playlist checks, ignoring answers for a playlist edited meanwhile', () => {
    const summary = { id: '7', title: 'Rock', playableTracks: 3 };
    let state = run(add('a'), { type: 'playlistChanged', key: 'a', playlist: '7' });
    state = designEditorReducer(state, {
      type: 'playlistChecked',
      key: 'a',
      playlist: '7',
      summary,
    });
    expect(state.rounds[0]).toMatchObject({ playlistTitle: 'Rock', playableTracks: 3 });

    state = designEditorReducer(state, { type: 'playlistChanged', key: 'a', playlist: '8' });
    expect(state.rounds[0]).toMatchObject({ playlistTitle: null, playableTracks: null });
    const late = designEditorReducer(state, {
      type: 'playlistChecked',
      key: 'a',
      playlist: '7',
      summary,
    });
    expect(late).toBe(state);
  });

  describe('round names', () => {
    const rock = { id: '7', title: 'Rock Anthems', playableTracks: 30 };
    const check = (key: string, playlist: string, summary = rock): EditorAction => ({
      type: 'playlistChecked',
      key,
      playlist,
      summary,
    });

    it('replaces what was pasted (e.g. a share link) with the canonical playlist URL', () => {
      const link = 'https://link.deezer.com/s/abc123';
      const state = run(
        add('a'),
        { type: 'playlistChanged', key: 'a', playlist: link },
        check('a', link),
      );
      expect(state.rounds[0]?.playlist).toBe('https://www.deezer.com/playlist/7');
    });

    it('prefills an empty name with the playlist title', () => {
      const state = run(
        add('a'),
        { type: 'playlistChanged', key: 'a', playlist: '7' },
        check('a', '7'),
      );
      expect(state.rounds[0]).toMatchObject({ name: 'Rock Anthems', nameIsAuto: true });
    });

    it('never overwrites a name typed by the host', () => {
      const state = run(
        add('a'),
        { type: 'roundRenamed', key: 'a', name: 'Warm-up' },
        { type: 'playlistChanged', key: 'a', playlist: '7' },
        check('a', '7'),
      );
      expect(state.rounds[0]).toMatchObject({ name: 'Warm-up', nameIsAuto: false });
    });

    it('follows the playlist while the name was filled in automatically', () => {
      const state = run(
        add('a'),
        { type: 'playlistChanged', key: 'a', playlist: '7' },
        check('a', '7'),
        { type: 'playlistChanged', key: 'a', playlist: '8' },
      );
      expect(state.rounds[0]?.name).toBe('');
      const renamed = designEditorReducer(state, check('a', '8', { ...rock, title: 'Jazz' }));
      expect(renamed.rounds[0]?.name).toBe('Jazz');
    });

    it('hands the name back to the playlist when the host clears it', () => {
      const state = run(
        add('a'),
        { type: 'roundRenamed', key: 'a', name: 'Warm-up' },
        { type: 'roundRenamed', key: 'a', name: '' },
        { type: 'playlistChanged', key: 'a', playlist: '7' },
        check('a', '7'),
      );
      expect(state.rounds[0]?.name).toBe('Rock Anthems');
    });

    it('fills in the name of a saved design that had none', () => {
      const unnamed = { ...design, rounds: [{ ...design.rounds[0]!, name: '' }] };
      const state = run({ type: 'loaded', design: unnamed }, check('saved-0', '42'));
      expect(state.rounds[0]?.name).toBe('Rock Anthems');
    });

    it('names a new round after the previous round playlist', () => {
      const state = run({ type: 'loaded', design }, add('b'));
      expect(state.rounds[1]).toMatchObject({ name: '80s', nameIsAuto: true });
    });
  });

  it('becomes clean once saved and builds the save payload', () => {
    const state = run({ type: 'loaded', design }, { type: 'renamed', name: 'Saturday' });
    expect(state.dirty).toBe(true);
    expect(toUpdatePayload(state)).toEqual({
      name: 'Saturday',
      rounds: [
        {
          name: 'My 80s',
          type: 'classic',
          playlist: '42',
          playlistTitle: '80s',
          rules: catalog.presets.classic,
        },
      ],
    });
    expect(
      designEditorReducer(state, { type: 'saved', design: { ...design, name: 'Saturday' } }).dirty,
    ).toBe(false);
  });
});

describe('roundWarnings / totalSongs', () => {
  it('warns about missing playlists and too short playlists', () => {
    const [round] = run(add('a')).rounds;
    if (!round) throw new Error('fixture');
    expect(roundWarnings(round)).toEqual(['Choose a Deezer playlist.']);
    expect(roundWarnings({ ...round, playlist: '7', playableTracks: 4 })).toEqual([
      'This playlist has only 4 playable tracks for 10 songs.',
    ]);
    expect(roundWarnings({ ...round, playlist: '7', playableTracks: 40 })).toEqual([]);
  });

  it('warns when the descending scale leaves the last winners without points', () => {
    const [round] = run(add('a'), { type: 'playlistChanged', key: 'a', playlist: '7' }).rounds;
    if (!round) throw new Error('fixture');
    const withScale = (rules: Partial<typeof round.rules>) => ({
      ...round,
      playableTracks: 40,
      rules: { ...round.rules, scoring: 'first' as const, ...rules },
    });
    const warning = 'With this many points lost per place, the last winners get no points.';

    // 3 points losing 1 per place over 3 winners: 3, 2, 1 → fine for the title, 0 for the artist.
    expect(roundWarnings(withScale({ winnerCount: 3, rankStep: 1, titlePoints: 3 }))).toContain(
      warning,
    );
    expect(
      roundWarnings(withScale({ winnerCount: 3, rankStep: 1, titlePoints: 3, artistPoints: 3 })),
    ).toEqual([]);
    expect(roundWarnings(withScale({ winnerCount: 3, rankStep: 0 }))).toEqual([]);
    expect(roundWarnings(withScale({ scoring: 'everyone', winnerCount: 3, rankStep: 5 }))).toEqual(
      [],
    );
  });

  it('counts the songs of the whole game', () => {
    expect(totalSongs(run(add('a'), add('b', 'flash')))).toBe(20);
  });
});

describe('team mode', () => {
  it('is off for new rounds and can be toggled per round', () => {
    const state = run({ type: 'loaded', design }, add('r2'));
    expect(state.rounds.map((r) => r.rules.teamMode)).toEqual([false, false]);

    const toggled = designEditorReducer(state, {
      type: 'teamModeChanged',
      key: 'r2',
      teamMode: true,
    });
    expect(toggled.rounds.map((r) => r.rules.teamMode)).toEqual([false, true]);
    expect(toggled.dirty).toBe(true);
    expect(toUpdatePayload(toggled).rounds.map((r) => r.rules.teamMode)).toEqual([false, true]);
  });

  it('survives a change of round type, which otherwise resets the rules to the preset', () => {
    const state = run(
      { type: 'loaded', design },
      { type: 'teamModeChanged', key: 'saved-0', teamMode: true },
      { type: 'roundTypeChanged', key: 'saved-0', roundType: 'flash', catalog },
    );
    expect(state.rounds[0]?.rules).toEqual({ ...catalog.presets.flash, teamMode: true });
  });
});
