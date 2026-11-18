import type { GameSnapshotDto } from '@ubt/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewayError, type GameGateway } from '@/shared/realtime/gameGateway';
import { useSessionStore } from '@/shared/session/sessionStore';
import { answer, gameRecap, hostSong, snapshot } from '@/test/fixtures';
import { fakeGateway, renderWithRealtime } from '@/test/renderWithRealtime';

import { HostGamePage } from './HostGamePage';

// A data router: the page blocks navigation while the game is on.
const renderHostWith = (gateway: GameGateway) =>
  renderWithRealtime(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: '/host/:gameId', element: <HostGamePage /> },
          { path: '/', element: <p>Home page</p> },
        ],
        { initialEntries: ['/host/g1'] },
      )}
    />,
    gateway,
  );

const renderPage = (game: GameSnapshotDto, gateway: Partial<GameGateway> = {}) =>
  renderHostWith(fakeGateway({ attachHost: vi.fn().mockResolvedValue(game), ...gateway }));

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

  describe('removing a player', () => {
    const two = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ];
    const kick = async (name: string) => {
      await userEvent.click(
        await screen.findByRole('button', { name: `Remove ${name} from the game` }),
      );
      await userEvent.click(screen.getByRole('button', { name: `Remove ${name}?` }));
    };

    it('kicks a player from the lobby', async () => {
      const kickPlayer = vi.fn().mockResolvedValue(two[0]);
      renderPage(snapshot({ players: two }), { kickPlayer });

      await kick('Alice');

      expect(kickPlayer).toHaveBeenCalledWith({ playerId: 'p1' });
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Remove Alice from the game' })).toBeNull(),
      );
      expect(screen.getByText('Players (1)')).toBeVisible();
    });

    it('can still kick while a song is playing, and drops the answer of the player', async () => {
      const kickPlayer = vi.fn().mockResolvedValue(two[0]);
      renderPage(
        snapshot({
          status: 'playing',
          currentSong: hostSong({ startedAt: Date.now() }),
          players: two,
          answers: [answer({ playerId: 'p1', playerName: 'Alice', text: 'Daft' })],
        }),
        { kickPlayer },
      );
      expect(await screen.findByText('Daft')).toBeVisible();

      await kick('Alice');

      await waitFor(() => expect(screen.queryByText('Daft')).not.toBeInTheDocument());
    });

    it('drops a player the server announced as kicked', async () => {
      const { emit } = renderPage(snapshot({ players: two }));
      await screen.findByText('Players (2)');

      emit('player:kicked', { playerId: 'p2' });

      expect(await screen.findByText('Players (1)')).toBeVisible();
    });

    it('says why a player could not be removed', async () => {
      const kickPlayer = vi
        .fn()
        .mockRejectedValue(new GatewayError({ code: 'GAME_FINISHED', message: 'over' }));
      renderPage(snapshot({ players: two }), { kickPlayer });

      await kick('Bob');

      expect(await screen.findByText('This game is over')).toBeVisible();
    });
  });

  describe('leaving a game that is on', () => {
    const clickLogo = () =>
      userEvent.click(screen.getByRole('link', { name: /Ultimate Blind Test/ }));

    it('asks what to do instead of leaving when the logo is clicked', async () => {
      renderPage(snapshot());
      await screen.findByText('The game · 2 rounds');

      await clickLogo();

      expect(screen.getByRole('dialog', { name: 'Leave the game?' })).toBeVisible();
      expect(screen.queryByText('Home page')).not.toBeInTheDocument();
    });

    it('stays on the game when the host cancels', async () => {
      renderPage(snapshot());
      await screen.findByText('The game · 2 rounds');
      await clickLogo();

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('The game · 2 rounds')).toBeVisible();
    });

    it('leaves without ending the game when asked to leave it running', async () => {
      const closeGame = vi.fn();
      renderPage(snapshot(), { closeGame });
      await screen.findByText('The game · 2 rounds');
      await clickLogo();

      await userEvent.click(screen.getByRole('button', { name: 'Leave it running' }));

      expect(await screen.findByText('Home page')).toBeVisible();
      expect(closeGame).not.toHaveBeenCalled();
    });

    it('ends the game for everyone, then leaves', async () => {
      const closeGame = vi.fn().mockResolvedValue([]);
      renderPage(snapshot(), { closeGame });
      await screen.findByText('The game · 2 rounds');
      await clickLogo();

      await userEvent.click(screen.getByRole('button', { name: 'End the game for everyone' }));

      expect(await screen.findByText('Home page')).toBeVisible();
      expect(closeGame).toHaveBeenCalledOnce();
    });

    it('stays put and says why when the game cannot be ended', async () => {
      const closeGame = vi
        .fn()
        .mockRejectedValue(
          new GatewayError({ code: 'GAME_FINISHED', message: 'This game is over' }),
        );
      renderPage(snapshot(), { closeGame });
      await screen.findByText('The game · 2 rounds');
      await clickLogo();

      await userEvent.click(screen.getByRole('button', { name: 'End the game for everyone' }));

      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.queryByText('Home page')).not.toBeInTheDocument();
    });

    it('warns before the tab is closed, but not once the game is over', async () => {
      const { unmount } = renderPage(snapshot());
      await screen.findByText('The game · 2 rounds');
      const closing = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(closing);
      expect(closing.defaultPrevented).toBe(true);
      unmount();

      renderPage(snapshot({ status: 'finished', hasNextSong: false }));
      await screen.findByText(/final scores/);
      const closed = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(closed);
      expect(closed.defaultPrevented).toBe(false);
    });

    it('keeps the way back after leaving it running', async () => {
      const closeGame = vi.fn().mockResolvedValue([]);
      renderPage(snapshot(), { closeGame });
      await screen.findByText('The game · 2 rounds');
      await clickLogo();
      await userEvent.click(screen.getByRole('button', { name: 'Leave it running' }));
      await screen.findByText('Home page');
      expect(useSessionStore.getState().host).not.toBeNull();
    });

    it('forgets the game once the host ended it and left', async () => {
      renderPage(snapshot(), { closeGame: vi.fn().mockResolvedValue([]) });
      await screen.findByText('The game · 2 rounds');
      await clickLogo();
      await userEvent.click(screen.getByRole('button', { name: 'End the game for everyone' }));
      await screen.findByText('Home page');
      expect(useSessionStore.getState().host).toBeNull();
    });

    it('forgets a game the server no longer has', async () => {
      renderHostWith(
        fakeGateway({
          attachHost: vi
            .fn()
            .mockRejectedValue(
              new GatewayError({ code: 'GAME_NOT_FOUND', message: 'Game not found' }),
            ),
        }),
      );
      await screen.findByRole('alert');
      expect(useSessionStore.getState().host).toBeNull();
    });

    it('lets the host leave a finished game freely', async () => {
      renderPage(snapshot({ status: 'finished', hasNextSong: false, recap: gameRecap() }));
      await screen.findByText('Friday night — final results');

      await clickLogo();

      expect(await screen.findByText('Home page')).toBeVisible();
    });
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

  describe('teams', () => {
    const alice = { id: 'p1', name: 'Alice' };
    const bob = { id: 'p2', name: 'Bob' };
    const teamGame = (overrides: Partial<GameSnapshotDto> = {}) => {
      const base = snapshot();
      return snapshot({
        players: [alice, bob],
        rounds: base.rounds.map((round, i) =>
          i === 0 ? { ...round, rules: { ...round.rules, teamMode: true } } : round,
        ),
        ...overrides,
      });
    };
    const generatedTeams = [
      { id: 'team-1', name: 'The Funky Flamingos', players: [alice] },
      { id: 'team-2', name: 'The Neon Llamas', players: [bob] },
    ];

    it('offers nothing about teams when no round uses the team mode', async () => {
      renderPage(snapshot({ players: [alice, bob] }));
      await screen.findByText('The game · 2 rounds');
      expect(screen.queryByRole('button', { name: 'Generate the teams' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Play the first song' })).toBeEnabled();
    });

    it('puts the generate button right before the start button, which waits for the teams', async () => {
      renderPage(teamGame());

      const generate = await screen.findByRole('button', { name: 'Generate the teams' });
      const start = screen.getByRole('button', { name: 'Play the first song' });
      expect(
        generate.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(start).toBeDisabled();
      expect(screen.getByText('Generate the teams before playing the first song.')).toBeVisible();
    });

    it('generates the teams, shows them, then allows to start', async () => {
      const generateTeams = vi.fn().mockResolvedValue(generatedTeams);
      renderHostWith(
        fakeGateway({ attachHost: vi.fn().mockResolvedValue(teamGame()), generateTeams }),
      );

      await userEvent.click(await screen.findByRole('button', { name: 'Generate the teams' }));

      expect(generateTeams).toHaveBeenCalledWith({ teamCount: 2 });
      const teams = await screen.findByRole('region', { name: 'Teams' });
      expect(within(teams).getByLabelText('Name of team 1')).toHaveValue('The Funky Flamingos');
      expect(within(teams).getByLabelText('Name of team 2')).toHaveValue('The Neon Llamas');
      expect(teams).toHaveTextContent('Alice');
      expect(teams).toHaveTextContent('Bob');
      expect(screen.getByRole('button', { name: 'Play the first song' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Shuffle the teams again' })).toBeVisible();
    });

    it('renames a team and shows the teams the server answers with', async () => {
      const renamed = [{ ...generatedTeams[0]!, name: 'Les Rois' }, generatedTeams[1]!];
      const renameTeam = vi.fn().mockResolvedValue(renamed);
      renderHostWith(
        fakeGateway({
          attachHost: vi.fn().mockResolvedValue(teamGame({ teams: generatedTeams })),
          renameTeam,
        }),
      );

      const input = await screen.findByLabelText('Name of team 1');
      await userEvent.clear(input);
      await userEvent.type(input, 'Les Rois{Enter}');

      expect(renameTeam).toHaveBeenCalledWith({ teamId: 'team-1', name: 'Les Rois' });
      await waitFor(() => expect(screen.getByLabelText('Name of team 1')).toHaveValue('Les Rois'));
    });

    it('moves a dragged player and shows the error when the server refuses', async () => {
      const carol = { id: 'p3', name: 'Carol' };
      const teams = [
        { id: 'team-1', name: 'The Funky Flamingos', players: [alice, carol] },
        { id: 'team-2', name: 'The Neon Llamas', players: [bob] },
      ];
      const movePlayers = vi
        .fn()
        .mockResolvedValueOnce([
          { ...teams[0]!, players: [carol] },
          { ...teams[1]!, players: [bob, alice] },
        ])
        .mockRejectedValueOnce(new GatewayError({ code: 'TEAMS_LOCKED', message: 'locked' }));
      renderHostWith(
        fakeGateway({
          attachHost: vi.fn().mockResolvedValue(teamGame({ players: [alice, bob, carol], teams })),
          movePlayers,
        }),
      );

      const [firstCard, secondCard] = (await screen.findAllByRole('listitem')).filter((li) =>
        li.querySelector('input'),
      );
      fireEvent.dragStart(within(firstCard!).getByRole('button', { name: 'Alice' }));
      fireEvent.drop(secondCard!);
      await waitFor(() =>
        expect(movePlayers).toHaveBeenCalledWith({ playerIds: ['p1'], teamId: 'team-2' }),
      );
      // Alice now sits in the second team.
      await waitFor(() =>
        expect(within(secondCard!).getByRole('button', { name: 'Alice' })).toBeVisible(),
      );

      fireEvent.dragStart(within(secondCard!).getByRole('button', { name: 'Bob' }));
      fireEvent.drop(firstCard!);
      expect(
        await screen.findByText('Teams can only be changed before the first song'),
      ).toBeVisible();
    });

    it('lets a host coming back find the teams already drawn', async () => {
      renderPage(teamGame({ teams: generatedTeams }));
      expect(await screen.findByRole('button', { name: 'Play the first song' })).toBeEnabled();
      expect(screen.getByLabelText('Name of team 2')).toHaveValue('The Neon Llamas');
    });

    it('shows the team scores above the players in the scores panel', async () => {
      renderPage(
        teamGame({
          status: 'playing',
          currentSong: hostSong({ revealed: true }),
          teams: generatedTeams,
          scoreboard: [
            { playerId: 'p1', playerName: 'Alice', points: 3 },
            { playerId: 'p2', playerName: 'Bob', points: 1 },
          ],
          teamScoreboard: [
            { teamId: 'team-1', teamName: 'The Funky Flamingos', points: 3 },
            { teamId: 'team-2', teamName: 'The Neon Llamas', points: 1 },
          ],
        }),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Scores' }));

      const panel = screen.getByRole('complementary', { name: 'Scores' });
      expect(within(panel).getByRole('list', { name: 'Team scoreboard' })).toHaveTextContent(
        '1.The Funky Flamingos3 pts',
      );
      expect(within(panel).getByRole('list', { name: 'Scoreboard' })).toHaveTextContent(
        '1.Alice3 pts',
      );
    });
  });
});
