import type { PlayerSessionDto } from '@ubt/shared';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/shared/session/sessionStore';
import { answer, gameRecap, playerSession } from '@/test/fixtures';
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

  describe('one guess per song', () => {
    const openSong = {
      id: 's1',
      roundNumber: 1,
      roundName: '',
      roundType: 'classic' as const,
      number: 1,
      songCount: 2,
      startedAt: Date.now(),
      answerTimeSec: 30,
      asksTitle: true,
      asksArtist: true,
      revealed: false,
    };
    const sent = answer({ songId: 's1' });

    it('removes the form once the answer is sent', async () => {
      renderPage(playerSession({ status: 'playing', currentSong: openSong, myAnswers: [sent] }));

      expect(await screen.findByText('Answer sent! Waiting for the others…')).toBeInTheDocument();
      expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
    });

    it('tells the player when everyone answered', async () => {
      renderPage(
        playerSession({
          status: 'playing',
          currentSong: openSong,
          myAnswers: [sent],
          everyoneAnswered: true,
        }),
      );

      expect(
        await screen.findByText('Everyone answered — waiting for the result…'),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
    });
  });

  describe('when the game is over', () => {
    it('shows the recap, worded for the player', async () => {
      renderPage(playerSession({ status: 'finished', recap: gameRecap() }));

      expect(await screen.findByText('Friday night — final results')).toBeInTheDocument();
      expect(screen.getByText('You finished #1 with 5 pts')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Awards' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Share my results' })).toBeInTheDocument();
    });

    it('shows the plain scores until the recap arrives', async () => {
      renderPage(
        playerSession({
          status: 'finished',
          scoreboard: [{ playerId: 'p1', playerName: 'Alice', points: 3 }],
        }),
      );

      expect(await screen.findByText('Friday night — final scores')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    });
  });

  describe('teams', () => {
    const teams = [
      {
        id: 'team-1',
        name: 'The Funky Flamingos',
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Chloé' },
        ],
      },
      { id: 'team-2', name: 'The Neon Llamas', players: [{ id: 'p4', name: 'Dan' }] },
    ];
    const teamRounds = () =>
      playerSession().rounds.map((round) => ({
        ...round,
        rules: { ...round.rules, teamMode: true },
      }));

    it('tells the player their team and their teammates', async () => {
      renderPage(playerSession({ rounds: teamRounds(), teams, myTeamId: 'team-1' }));

      const mine = await screen.findByLabelText('Your team');
      expect(mine).toHaveTextContent('Your team: The Funky Flamingos');
      expect(mine).toHaveTextContent('with Bob, Chloé');
      expect(mine).not.toHaveTextContent('with Alice');
    });

    it('says the teams are coming while the host has not drawn them', async () => {
      renderPage(playerSession({ rounds: teamRounds() }));
      expect(await screen.findByText('The host will draw the teams soon.')).toBeVisible();
      expect(screen.queryByLabelText('Your team')).not.toBeInTheDocument();
    });

    it('says nothing about teams when no round uses them', async () => {
      renderPage(playerSession());
      await screen.findByText('Waiting for the host to play the first song…');
      expect(screen.queryByText(/draw the teams/)).not.toBeInTheDocument();
    });

    it('ranks the teams next to the players once points are scored', async () => {
      renderPage(
        playerSession({
          rounds: teamRounds(),
          teams,
          myTeamId: 'team-2',
          scoreboard: [{ playerId: 'p1', playerName: 'Alice', points: 2 }],
          teamScoreboard: [
            { teamId: 'team-1', teamName: 'The Funky Flamingos', points: 2 },
            { teamId: 'team-2', teamName: 'The Neon Llamas', points: 0 },
          ],
        }),
      );

      const board = await screen.findByRole('list', { name: 'Team scoreboard' });
      expect(board).toHaveTextContent('1.The Funky Flamingos2 pts');
      expect(board).toHaveTextContent('2.The Neon Llamas0 pts');
    });
  });
});
