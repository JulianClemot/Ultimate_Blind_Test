import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RECENT_GAME_TTL_MS, useRecentGamesStore } from '@/shared/session/recentGamesStore';
import { renderWithRealtime } from '@/test/renderWithRealtime';

import { ResumeGames } from './ResumeGames';

const game = (savedAt: number) => ({
  gameId: 'g1',
  playerId: 'p1',
  playerName: 'Alice',
  gameName: 'Friday night',
  code: 'ABCDEF',
  savedAt,
});

const fetchMock = vi.fn();

/** Answers the status request of the one remembered game. */
const serverSays = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

const renderList = () =>
  renderWithRealtime(
    <MemoryRouter>
      <ResumeGames />
    </MemoryRouter>,
  );

describe('<ResumeGames />', () => {
  beforeEach(() => {
    useRecentGamesStore.setState({ games: [] });
    vi.stubGlobal('fetch', fetchMock);
    serverSays(200, { status: 'playing' });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('renders nothing without a recent game', () => {
    renderList();
    expect(screen.queryByText('Your recent games')).not.toBeInTheDocument();
  });

  it('links back to the party the player left', () => {
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    expect(screen.getByText('Friday night')).toBeInTheDocument();
    expect(screen.getByText('You are Alice · code ABCDEF')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rejoin' })).toHaveAttribute('href', '/play/g1');
  });

  it('asks the server about the game, as the player', async () => {
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/games/g1/status?playerId=p1');
    expect(screen.getByRole('link', { name: 'Rejoin' })).toBeVisible();
    expect(screen.queryByText('Finished')).not.toBeInTheDocument();
  });

  it('says a game is finished and offers its results instead', async () => {
    serverSays(200, { status: 'finished' });
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    expect(await screen.findByText('Finished')).toBeVisible();
    expect(screen.getByRole('link', { name: 'See results' })).toHaveAttribute('href', '/play/g1');
    expect(screen.queryByRole('link', { name: 'Rejoin' })).not.toBeInTheDocument();
  });

  it('drops a game the server no longer knows', async () => {
    serverSays(404, { code: 'GAME_NOT_FOUND', message: 'Game not found' });
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    await waitFor(() => expect(useRecentGamesStore.getState().games).toEqual([]));
    expect(screen.queryByText('Friday night')).not.toBeInTheDocument();
  });

  it('keeps offering a game when the check itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Rejoin' })).toBeVisible();
    expect(useRecentGamesStore.getState().games).toHaveLength(1);
  });

  it('hides a game that is too old to be running', () => {
    useRecentGamesStore.setState({ games: [game(Date.now() - RECENT_GAME_TTL_MS - 1)] });
    renderList();
    expect(screen.queryByRole('link', { name: 'Rejoin' })).not.toBeInTheDocument();
  });

  it('lets the player forget a game', async () => {
    useRecentGamesStore.setState({ games: [game(Date.now())] });
    renderList();

    await userEvent.click(screen.getByRole('button', { name: 'Forget Friday night' }));

    expect(useRecentGamesStore.getState().games).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Rejoin' })).not.toBeInTheDocument();
  });
});
