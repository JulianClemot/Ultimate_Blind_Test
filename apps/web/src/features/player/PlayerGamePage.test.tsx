import type { PlayerSessionDto } from '@ubt/shared';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/shared/session/sessionStore';
import { playerSession } from '@/test/fixtures';
import { fakeGateway, renderWithRealtime } from '@/test/renderWithRealtime';

import { PlayerGamePage } from './PlayerGamePage';

const renderPage = (session: PlayerSessionDto) =>
  renderWithRealtime(
    <MemoryRouter initialEntries={['/play/g1']}>
      <Routes>
        <Route path="/play/:gameId" element={<PlayerGamePage />} />
      </Routes>
    </MemoryRouter>,
    fakeGateway({ rejoinGame: vi.fn().mockResolvedValue(session) }),
  );

describe('<PlayerGamePage />', () => {
  beforeEach(() => {
    useSessionStore.setState({
      player: { gameId: 'g1', playerId: 'p1', playerName: 'Alice' },
    });
  });

  it('shows every round and its rules while the host has not started', async () => {
    renderPage(playerSession());

    expect(
      await screen.findByText('Waiting for the host to play the first song…'),
    ).toBeInTheDocument();
    expect(screen.getByText('How the game works · 2 rounds')).toBeInTheDocument();
    const overview = screen.getByRole('list', { name: 'Rounds of the game' });
    expect(overview).toHaveTextContent('Round 1/2 · Classic');
    expect(overview).toHaveTextContent('Find the title (1 point) and the artist (1 point)');
    expect(overview).toHaveTextContent('Only the first 4 s of each song are played');
  });

  it('hides the overview once a song is playing', async () => {
    renderPage(
      playerSession({
        status: 'playing',
        currentSong: {
          id: 's1',
          roundNumber: 1,
          roundName: '',
          roundType: 'classic',
          number: 1,
          songCount: 2,
          startedAt: Date.now(),
          answerTimeSec: 30,
          asksTitle: true,
          asksArtist: true,
          revealed: false,
        },
      }),
    );

    expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
    expect(screen.queryByText(/How the game works/)).not.toBeInTheDocument();
  });
});
