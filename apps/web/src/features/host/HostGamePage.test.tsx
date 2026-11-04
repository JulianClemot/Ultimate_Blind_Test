import type { GameSnapshotDto } from '@ubt/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/shared/session/sessionStore';
import { gameRecap, hostSong, snapshot } from '@/test/fixtures';
import { fakeGateway, renderWithRealtime } from '@/test/renderWithRealtime';

import { HostGamePage } from './HostGamePage';

const renderPage = (game: GameSnapshotDto) =>
  renderWithRealtime(
    <MemoryRouter initialEntries={['/host/g1']}>
      <Routes>
        <Route path="/host/:gameId" element={<HostGamePage />} />
      </Routes>
    </MemoryRouter>,
    fakeGateway({ attachHost: vi.fn().mockResolvedValue(game) }),
  );

describe('<HostGamePage />', () => {
  beforeEach(() => {
    useSessionStore.setState({ host: { gameId: 'g1', hostToken: 'secret' } });
  });

  it('shows every round and its rules in the lobby', async () => {
    renderPage(snapshot());

    expect(await screen.findByText('The game · 2 rounds')).toBeInTheDocument();
    const overview = screen.getByRole('list', { name: 'Rounds of the game' });
    expect(overview).toHaveTextContent('Round 1/2 · Classic');
    expect(overview).toHaveTextContent('Only the first 4 s of each song are played');
  });

  it('shows a QR code in the lobby that targets the LAN address, not localhost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ addresses: ['192.168.1.42'] })),
    );
    renderPage(snapshot({ code: 'ABCDEF' }));

    const qr = await screen.findByRole('img', { name: /QR code to join the game/ });
    expect(qr.getAttribute('aria-label')).toContain(`192.168.1.42`);
    expect(qr.getAttribute('aria-label')).toContain('?code=ABCDEF');
    expect(qr.querySelector('svg')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('hides the overview once a song is playing', async () => {
    renderPage(snapshot({ status: 'playing', currentSong: hostSong() }));

    expect(await screen.findByText('Song 1/2')).toBeInTheDocument();
    expect(screen.queryByText(/^The game ·/)).not.toBeInTheDocument();
  });

  describe('scores panel', () => {
    const scoredGame = () =>
      snapshot({
        status: 'playing',
        currentSong: hostSong({ revealed: true }),
        scoreboard: [
          { playerId: 'p2', playerName: 'Bob', points: 3 },
          { playerId: 'p1', playerName: 'Alice', points: 1 },
        ],
      });

    it('is closed by default and toggles with the Scores button', async () => {
      renderPage(scoredGame());
      const toggle = await screen.findByRole('button', { name: 'Scores' });
      expect(screen.queryByRole('complementary', { name: 'Scores' })).not.toBeInTheDocument();

      await userEvent.click(toggle);
      const panel = screen.getByRole('complementary', { name: 'Scores' });
      expect(panel).toHaveTextContent('1.Bob3 pts');
      expect(panel).toHaveTextContent('2.Alice1 pts');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(toggle);
      expect(screen.queryByRole('complementary', { name: 'Scores' })).not.toBeInTheDocument();
    });

    it('closes with its own button and with Escape', async () => {
      renderPage(scoredGame());
      await userEvent.click(await screen.findByRole('button', { name: 'Scores' }));
      await userEvent.click(screen.getByRole('button', { name: 'Close scores' }));
      expect(screen.queryByRole('complementary', { name: 'Scores' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Scores' }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('complementary', { name: 'Scores' })).not.toBeInTheDocument();
    });

    it('is available in the lobby too, before any song', async () => {
      renderPage(snapshot());
      await userEvent.click(await screen.findByRole('button', { name: 'Scores' }));
      expect(screen.getByRole('complementary', { name: 'Scores' })).toHaveTextContent('Alice0 pts');
    });
  });

  describe('when the game is over', () => {
    it('shows the recap with a button to share the results', async () => {
      renderPage(snapshot({ status: 'finished', hasNextSong: false, recap: gameRecap() }));

      expect(await screen.findByText('Friday night — final results')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Podium' })).toHaveTextContent('Alice');
      expect(screen.getByRole('button', { name: 'Share the results' })).toBeInTheDocument();
    });

    it('shows the plain scores until the recap arrives', async () => {
      renderPage(snapshot({ status: 'finished', hasNextSong: false }));

      expect(await screen.findByText('Friday night — final scores')).toBeInTheDocument();
    });
  });
});
