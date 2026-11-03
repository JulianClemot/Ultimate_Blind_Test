import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { catalog } from '@/test/fixtures';
import { renderWithRealtime } from '@/test/renderWithRealtime';

import type { EditorRound } from '../designEditorState';
import { RoundEditor } from './RoundEditor';

const round = (rules: Partial<EditorRound['rules']> = {}): EditorRound => ({
  key: 'r1',
  name: '',
  nameIsAuto: false,
  type: 'classic',
  playlist: '42',
  playlistTitle: null,
  playableTracks: 100,
  rules: { ...catalog.presets.classic, ...rules },
});

const setup = (rules?: Partial<EditorRound['rules']>) => {
  const dispatch = vi.fn();
  renderWithRealtime(
    <RoundEditor round={round(rules)} index={0} count={1} catalog={catalog} dispatch={dispatch} />,
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
});
