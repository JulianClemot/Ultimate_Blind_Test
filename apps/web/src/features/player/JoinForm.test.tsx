import type { PlayerSessionDto } from '@ubt/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GatewayError } from '@/shared/realtime/gameGateway';
import { useSessionStore } from '@/shared/session/sessionStore';
import { playerSession } from '@/test/fixtures';
import { fakeGateway, renderWithRealtime } from '@/test/renderWithRealtime';

import { JoinForm } from './JoinForm';

const session: PlayerSessionDto = playerSession();

describe('<JoinForm />', () => {
  it('joins the game and remembers the player session', async () => {
    const joinGame = vi.fn().mockResolvedValue(session);
    const onJoined = vi.fn();
    renderWithRealtime(<JoinForm onJoined={onJoined} />, fakeGateway({ joinGame }));

    await userEvent.type(screen.getByLabelText('Game code'), 'abcdef');
    await userEvent.type(screen.getByLabelText('Your name'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(joinGame).toHaveBeenCalledWith({ code: 'abcdef', playerName: 'Alice' });
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(session));
    expect(useSessionStore.getState().player).toEqual({
      gameId: 'g1',
      playerId: 'p1',
      playerName: 'Alice',
    });
  });

  it('displays server errors', async () => {
    const joinGame = vi
      .fn()
      .mockRejectedValue(new GatewayError({ code: 'GAME_NOT_FOUND', message: 'Game not found' }));
    renderWithRealtime(<JoinForm onJoined={vi.fn()} />, fakeGateway({ joinGame }));

    await userEvent.type(screen.getByLabelText('Game code'), 'ZZZZZZ');
    await userEvent.type(screen.getByLabelText('Your name'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Game not found');
  });

  it('cannot be submitted empty', () => {
    renderWithRealtime(<JoinForm onJoined={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
  });
});
