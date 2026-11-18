import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TeamsPanel } from './TeamsPanel';

const players = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));

const teams = [
  { id: 'team-1', name: 'The Funky Flamingos', players: players(2) },
  { id: 'team-2', name: 'The Neon Llamas', players: [{ id: 'p3', name: 'Chloé' }] },
];

const setup = (props: Partial<Parameters<typeof TeamsPanel>[0]> = {}) => {
  const onGenerate = vi.fn();
  const onRename = vi.fn();
  const onMovePlayers = vi.fn();
  render(
    <TeamsPanel
      players={players(5)}
      teams={[]}
      pending={false}
      error={null}
      onGenerate={onGenerate}
      onRename={onRename}
      onMovePlayers={onMovePlayers}
      {...props}
    />,
  );
  return { onGenerate, onRename, onMovePlayers };
};

describe('<TeamsPanel />', () => {
  it('generates two teams by default', async () => {
    const { onGenerate } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Generate the teams' }));
    expect(onGenerate).toHaveBeenCalledWith(2);
  });

  it('lets the host pick the number of teams', async () => {
    const { onGenerate } = setup();
    await userEvent.selectOptions(screen.getByLabelText('Number of teams'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Generate the teams' }));
    expect(onGenerate).toHaveBeenCalledWith(4);
  });

  it('never offers more teams than players, nor more than four', () => {
    setup({ players: players(3) });
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['2 teams', '3 teams']);
  });

  it('caps the offer at four teams however many players joined', () => {
    setup({ players: players(12) });
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('waits for two players', () => {
    setup({ players: players(1) });
    expect(screen.getByRole('button', { name: 'Generate the teams' })).toBeDisabled();
    expect(screen.getByText('Wait for at least 2 players to join.')).toBeInTheDocument();
  });

  it('shows the teams with their members and offers to shuffle again', () => {
    setup({ teams });
    expect(screen.getByRole('button', { name: 'Shuffle the teams again' })).toBeEnabled();
    expect(screen.getByLabelText('Name of team 1')).toHaveValue('The Funky Flamingos');
    expect(screen.getByLabelText('Name of team 2')).toHaveValue('The Neon Llamas');
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent('Player 1');
    expect(first).toHaveTextContent('Player 2');
    expect(second).toHaveTextContent('Chloé');
    expect(screen.getByRole('button', { name: 'Chloé' })).toBeVisible();
    expect(screen.getByText(/Players who join later are added to the smallest team/)).toBeVisible();
  });

  describe('adjusting the teams', () => {
    it('renames a team when the host leaves the field', async () => {
      const { onRename } = setup({ teams });
      const input = screen.getByLabelText('Name of team 1');
      await userEvent.clear(input);
      await userEvent.type(input, 'Les Rois');
      await userEvent.tab();
      expect(onRename).toHaveBeenCalledWith('team-1', 'Les Rois');
    });

    it('renames a team on Enter', async () => {
      const { onRename } = setup({ teams });
      const input = screen.getByLabelText('Name of team 2');
      await userEvent.clear(input);
      await userEvent.type(input, 'Les Reines{Enter}');
      expect(onRename).toHaveBeenCalledWith('team-2', 'Les Reines');
    });

    it('does not call the server when the name did not change or was emptied', async () => {
      const { onRename } = setup({ teams });
      const input = screen.getByLabelText('Name of team 1');
      await userEvent.click(input);
      await userEvent.tab();
      await userEvent.clear(input);
      await userEvent.tab();
      expect(onRename).not.toHaveBeenCalled();
      expect(input).toHaveValue('The Funky Flamingos');
    });

    const secondCard = 1;
    const card = (index: number) => screen.getAllByRole('listitem')[index]!;
    const player = (name: string) => screen.getByRole('button', { name });

    it('moves a player dragged onto another team', () => {
      const { onMovePlayers } = setup({ teams });
      fireEvent.dragStart(player('Player 1'));
      fireEvent.dragOver(card(secondCard));
      fireEvent.drop(card(secondCard));
      expect(onMovePlayers).toHaveBeenCalledWith(['p1'], 'team-2');
    });

    it('moves every selected player when one of them is dragged', async () => {
      const { onMovePlayers } = setup({ teams });
      await userEvent.click(player('Player 1'));
      await userEvent.click(player('Player 2'));
      expect(player('Player 1')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.dragStart(player('Player 2'));
      fireEvent.drop(card(secondCard));
      expect(onMovePlayers).toHaveBeenCalledWith(['p1', 'p2'], 'team-2');
      // The selection is spent once moved.
      expect(player('Player 1')).toHaveAttribute('aria-pressed', 'false');
    });

    it('drags an unselected player alone, leaving the selection out of it', async () => {
      const { onMovePlayers } = setup({ teams });
      await userEvent.click(player('Player 1'));
      fireEvent.dragStart(player('Chloé'));
      fireEvent.drop(card(0));
      expect(onMovePlayers).toHaveBeenCalledWith(['p3'], 'team-1');
    });

    it('moves the selection with the button of a team, for touch screens and keyboards', async () => {
      const { onMovePlayers } = setup({ teams });
      await userEvent.click(player('Player 1'));
      await userEvent.click(player('Chloé'));
      await userEvent.click(screen.getAllByRole('button', { name: 'Move 2 selected here' })[1]!);
      // Chloé already sits in the second team: only Player 1 actually moves.
      expect(onMovePlayers).toHaveBeenCalledWith(['p1'], 'team-2');
    });

    it('does not bother the server for players already in the team', () => {
      const { onMovePlayers } = setup({ teams });
      fireEvent.dragStart(player('Chloé'));
      fireEvent.drop(card(secondCard));
      expect(onMovePlayers).not.toHaveBeenCalled();
    });

    it('ignores a drop that does not come from a player', () => {
      const { onMovePlayers } = setup({ teams });
      fireEvent.drop(card(0));
      expect(onMovePlayers).not.toHaveBeenCalled();
    });

    it('highlights the team under the dragged players', () => {
      setup({ teams });
      fireEvent.dragStart(player('Player 1'));
      fireEvent.dragOver(card(secondCard));
      expect(card(secondCard).className).toContain('ring-2');
      fireEvent.dragEnd(player('Player 1'));
      expect(card(secondCard).className).not.toContain('ring-2');
    });

    it('disables the edits while a request is pending', () => {
      setup({ teams, pending: true });
      expect(screen.getByLabelText('Name of team 1')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Player 1' })).toBeDisabled();
    });
  });

  it('is disabled while generating', () => {
    setup({ pending: true });
    expect(screen.getByRole('button', { name: 'Generate the teams' })).toBeDisabled();
  });
});
