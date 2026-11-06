import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
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
  render(
    <TeamsPanel
      players={players(5)}
      teams={[]}
      pending={false}
      error={null}
      onGenerate={onGenerate}
      {...props}
    />,
  );
  return onGenerate;
};

describe('<TeamsPanel />', () => {
  it('generates two teams by default', async () => {
    const onGenerate = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Generate the teams' }));
    expect(onGenerate).toHaveBeenCalledWith(2);
  });

  it('lets the host pick the number of teams', async () => {
    const onGenerate = setup();
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
    const list = screen.getByRole('list');
    expect(list).toHaveTextContent('The Funky Flamingos (2)Player 1, Player 2');
    expect(list).toHaveTextContent('The Neon Llamas (1)Chloé');
    expect(screen.getByText(/Players who join later are added to the smallest team/)).toBeVisible();
  });

  it('is disabled while generating', () => {
    setup({ pending: true });
    expect(screen.getByRole('button', { name: 'Generate the teams' })).toBeDisabled();
  });
});
