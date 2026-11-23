import type { EliminationDto, PlayerSessionDto } from '@ubt/shared';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/shared/session/sessionStore';
import { playerSession } from '@/test/fixtures';
import { fakeGateway, renderWithRealtime } from '@/test/renderWithRealtime';

import { PlayerGamePage } from './PlayerGamePage';
import { playerGameReducer } from './playerGameState';

const alice = { id: 'p1', name: 'Alice' };
const bob = { id: 'p2', name: 'Bob' };

const elimination = (overrides: Partial<EliminationDto> = {}): EliminationDto => ({
  roundNumber: 1,
  remaining: [alice, bob],
  eliminated: [],
  leftAfterCurrentSong: [],
  ...overrides,
});

const openSong = {
  id: 's1',
  roundNumber: 1,
  roundName: '',
  roundType: 'last-standing' as const,
  number: 2,
  songCount: 50,
  startedAt: Date.now(),
  answerTimeSec: 30,
  asksTitle: true,
  asksArtist: true,
  revealed: false,
  asksSource: false,
  suggestions: [],
  elimination: elimination(),
};

const renderPage = (session: PlayerSessionDto) =>
  renderWithRealtime(
    <MemoryRouter initialEntries={['/play/g1']}>
      <Routes>
        <Route path="/play/:gameId" element={<PlayerGamePage />} />
      </Routes>
    </MemoryRouter>,
    fakeGateway({ rejoinGame: vi.fn().mockResolvedValue(session) }),
  );

describe('player screen in a last-standing round', () => {
  beforeEach(() => {
    useSessionStore.setState({ player: { gameId: 'g1', playerId: 'p1', playerName: 'Alice' } });
  });

  it('lets a player who is still in answer, and counts the others', async () => {
    renderPage(
      playerSession({ status: 'playing', currentSong: openSong, elimination: elimination() }),
    );

    expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
    expect(screen.getByText('2 players still in')).toBeInTheDocument();
    expect(screen.getByText('Song 2')).toBeInTheDocument();
  });

  it('keeps an eliminated player watching: no form, a clear message', async () => {
    renderPage(
      playerSession({
        status: 'playing',
        currentSong: openSong,
        elimination: elimination({ remaining: [bob], eliminated: [alice] }),
      }),
    );

    expect(await screen.findByText('You are out!')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
  });

  it('congratulates the last one standing', async () => {
    renderPage(
      playerSession({
        status: 'playing',
        currentSong: { ...openSong, revealed: true },
        elimination: elimination({
          remaining: [alice],
          eliminated: [bob],
          leftAfterCurrentSong: [bob],
        }),
      }),
    );

    expect(
      await screen.findByText('You are the last one standing — congratulations!'),
    ).toBeInTheDocument();
    expect(screen.getByText('Out after this song: Bob')).toBeInTheDocument();
  });
});

describe('playerGameReducer in a last-standing round', () => {
  const session = playerSession({ status: 'playing', currentSong: openSong });

  it('follows the elimination of a reveal, a correction and a new song', () => {
    const left = elimination({
      remaining: [alice],
      eliminated: [bob],
      leftAfterCurrentSong: [bob],
    });
    const revealed = playerGameReducer(session, {
      type: 'songRevealed',
      reveal: {
        songId: 's1',
        title: 'T',
        artist: 'A',
        source: null,
        scoreboard: [],
        teamScoreboard: [],
        elimination: left,
      },
    });
    expect(revealed?.elimination).toEqual(left);

    const corrected = playerGameReducer(revealed, {
      type: 'eliminationUpdated',
      elimination: elimination(),
    });
    expect(corrected?.elimination?.remaining).toEqual([alice, bob]);

    const next = playerGameReducer(corrected, {
      type: 'songStarted',
      song: { ...openSong, id: 's2', elimination: null },
    });
    expect(next?.elimination).toBeNull();
  });
});
