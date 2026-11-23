import { describe, expect, it } from 'vitest';

import { catalog } from '@/test/fixtures';

import {
  designEditorReducer,
  emptyEditor,
  roundWarnings,
  totalSongs,
  type EditorAction,
} from './designEditorState';

const run = (...actions: EditorAction[]) => actions.reduce(designEditorReducer, emptyEditor);

const add = (roundType: 'classic' | 'last-standing'): EditorAction => ({
  type: 'roundAdded',
  key: 'a',
  roundType,
  catalog,
});

describe('last-standing rounds in the editor', () => {
  it('start from their preset', () => {
    expect(run(add('last-standing')).rounds[0]?.rules).toEqual(catalog.presets['last-standing']);
  });

  it('take the preset song cap instead of keeping the previous song count', () => {
    const toStanding = run(
      add('classic'),
      { type: 'ruleChanged', key: 'a', rule: 'songCount', value: 3 },
      { type: 'roundTypeChanged', key: 'a', roundType: 'last-standing', catalog },
    );
    expect(toStanding.rounds[0]?.rules.songCount).toBe(50);

    const back = designEditorReducer(toStanding, {
      type: 'roundTypeChanged',
      key: 'a',
      roundType: 'classic',
      catalog,
    });
    expect(back.rounds[0]?.rules.songCount).toBe(catalog.presets.classic.songCount);
  });

  it('adjust the number of players out per song', () => {
    const state = run(add('last-standing'), {
      type: 'ruleChanged',
      key: 'a',
      rule: 'eliminationCount',
      value: 4,
    });
    expect(state.rounds[0]?.rules.eliminationCount).toBe(4);
  });

  it('do not count in the songs of the game, nor warn about the cap', () => {
    const state = run(add('last-standing'), {
      type: 'playlistChecked',
      key: 'a',
      playlist: '',
      summary: { id: '1', title: 'Pop', playableTracks: 12 },
    });
    expect(totalSongs(state)).toBe(0);
    const round = run(
      add('last-standing'),
      { type: 'playlistChanged', key: 'a', playlist: '1' },
      {
        type: 'playlistChecked',
        key: 'a',
        playlist: '1',
        summary: { id: '1', title: 'Pop', playableTracks: 12 },
      },
    ).rounds[0];
    expect(round && roundWarnings(round)).toEqual([]);
  });
});
