import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlayerList } from './PlayerList';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('<PlayerList />', () => {
  it('only lists the players when nobody can be removed', () => {
    render(<PlayerList players={players} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('removes a player only after a confirmation', async () => {
    const onKick = vi.fn();
    render(<PlayerList players={players} onKick={onKick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Alice from the game' }));
    expect(onKick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Alice?' }));

    expect(onKick).toHaveBeenCalledExactlyOnceWith(players[0]);
    expect(screen.getByRole('button', { name: 'Remove Alice from the game' })).toBeVisible();
  });

  it('lets the host change their mind', async () => {
    const onKick = vi.fn();
    render(<PlayerList players={players} onKick={onKick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Bob from the game' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onKick).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove Bob?' })).not.toBeInTheDocument();
  });
});
