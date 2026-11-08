import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { catalog } from '@/test/fixtures';
import { renderWithRealtime } from '@/test/renderWithRealtime';

import type { EditorRound } from '../designEditorState';
import { RoundEditor } from './RoundEditor';

const access = { designId: 'd1', editToken: 'tok' };

const round = (rules: Partial<EditorRound['rules']> = {}): EditorRound => ({
  key: 'r1',
  name: '',
  nameIsAuto: false,
  type: 'classic',
  playlist: '42',
  playlistTitle: null,
  playableTracks: 100,
  rules: { ...catalog.presets.classic, ...rules },
  sourceOverrides: {},
});

const setup = (rules?: Partial<EditorRound['rules']>) => {
  const dispatch = vi.fn();
  renderWithRealtime(
    <RoundEditor
      access={access}
      round={round(rules)}
      index={0}
      count={1}
      catalog={catalog}
      dispatch={dispatch}
    />,
  );
  return dispatch;
};

describe('<RoundEditor /> winners', () => {
  it('lets the host choose how many first players get the points', async () => {
    const dispatch = setup({ winnerCount: 2 });
    const input = screen.getByLabelText(/Number of winners/);
    expect(input).toHaveValue(2);
    expect(input).toHaveAttribute('min', '1');

    await userEvent.type(input, '3');

    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'ruleChanged',
      key: 'r1',
      rule: 'winnerCount',
      value: 23,
    });
  });

  it('hides the number of winners when everyone can score', () => {
    setup({ scoring: 'everyone' });
    expect(screen.queryByLabelText(/Number of winners/)).not.toBeInTheDocument();
  });

  it('shows it again when switching to first players only', async () => {
    const dispatch = setup({ scoring: 'everyone' });
    await userEvent.selectOptions(screen.getByLabelText('Who scores'), 'first');
    expect(dispatch).toHaveBeenCalledWith({ type: 'scoringChanged', key: 'r1', scoring: 'first' });
  });

  it('offers the points lost per place only when several first players can win', () => {
    for (const [rules, visible] of [
      [{ winnerCount: 3 }, true],
      [{ winnerCount: 1 }, false],
      [{ scoring: 'everyone', winnerCount: 3 }, false],
    ] as const) {
      const { unmount } = renderWithRealtime(
        <RoundEditor
          access={access}
          round={round(rules)}
          index={0}
          count={1}
          catalog={catalog}
          dispatch={vi.fn()}
        />,
      );
      expect(!!screen.queryByLabelText(/Points lost per place/)).toBe(visible);
      unmount();
    }
  });

  it('sets the points lost per place', async () => {
    const dispatch = setup({ winnerCount: 3, rankStep: 1 });
    await userEvent.type(screen.getByLabelText(/Points lost per place/), '5');
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'ruleChanged',
      key: 'r1',
      rule: 'rankStep',
      value: 15,
    });
  });
});

describe('<RoundEditor /> team mode', () => {
  it('is visible without opening the rules, and off by default', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: /Team mode/ })).not.toBeChecked();
  });

  it('reflects a round saved in team mode', () => {
    setup({ teamMode: true });
    expect(screen.getByRole('checkbox', { name: /Team mode/ })).toBeChecked();
  });

  it('lets the host turn it on or off for this round', async () => {
    const dispatch = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /Team mode/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'teamModeChanged', key: 'r1', teamMode: true });
  });
});

describe('<RoundEditor /> easy mode', () => {
  it('is off by default and reflects a round saved in easy mode', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: /Easy mode/ })).not.toBeChecked();
  });

  it('lets the host turn it on for this round', async () => {
    const dispatch = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /Easy mode/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'easyModeChanged', key: 'r1', easyMode: true });
  });
});
