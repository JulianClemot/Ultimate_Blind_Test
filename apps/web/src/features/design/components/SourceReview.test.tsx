import type { PlaylistAnalysisDto } from '@ubt/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@/test/fixtures';

import type { EditorRound } from '../designEditorState';
import { SourceReview } from './SourceReview';

const access = { designId: 'd1', editToken: 'tok' };

const analysis = (overrides: Partial<PlaylistAnalysisDto> = {}): PlaylistAnalysisDto => ({
  id: '55',
  title: 'Disney',
  kind: 'movies',
  lookup: 'ai',
  tracks: [
    {
      id: '1',
      title: 'Let It Go',
      artist: 'Idina Menzel',
      source: { name: 'Frozen', medium: 'movie' },
    },
    { id: '2', title: 'Roar', artist: 'Katy Perry', source: null },
  ],
  ...overrides,
});

const round = (overrides: Partial<EditorRound> = {}): EditorRound => ({
  key: 'r1',
  name: '',
  nameIsAuto: false,
  type: 'classic',
  playlist: 'https://www.deezer.com/playlist/55',
  playlistTitle: 'Disney',
  playableTracks: 3,
  rules: catalog.presets.classic,
  sourceOverrides: {},
  ...overrides,
});

const screenRound = (overrides: Partial<EditorRound> = {}) =>
  round({ type: 'screen', rules: catalog.presets.screen, ...overrides });

const fetchMock = vi.fn();

const setup = (editorRound: EditorRound, data: PlaylistAnalysisDto = analysis()) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
  const dispatch = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SourceReview access={access} round={editorRound} catalog={catalog} dispatch={dispatch} />
    </QueryClientProvider>,
  );
  return dispatch;
};

describe('<SourceReview />', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('waits for the playlist to be checked', () => {
    setup(round({ playableTracks: null }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Looking for/)).not.toBeInTheDocument();
  });

  it('asks for the analysis with the edit token of the design', async () => {
    setup(round());
    expect(screen.getByText(/Looking for the films, series and games/)).toBeInTheDocument();
    await screen.findByText(/Film music detected/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      '/api/playlists/analyze?playlist=https%3A%2F%2Fwww.deezer.com%2Fplaylist%2F55&designId=d1',
    );
    expect(init).toMatchObject({ headers: { Authorization: 'Bearer tok' } });
  });

  it('tells what was detected, with the tracks matched', async () => {
    setup(round());
    expect(
      await screen.findByText('Film music detected: 1 of 2 tracks come from a film.'),
    ).toBeVisible();
  });

  it.each([
    ['series', 'TV series music detected: 1 of 2 tracks come from a series.'],
    ['games', 'Video game music detected: 1 of 2 tracks come from a game.'],
    ['mixed', 'Films, series and games detected: 1 of 2 tracks come from one of them.'],
    ['music', 'Looks like regular music: only 1 of 2 tracks come from a film, series or game.'],
  ] as const)('words a %s playlist', async (kind, text) => {
    setup(round(), analysis({ kind }));
    expect(await screen.findByText(text)).toBeVisible();
  });

  it('says when only the metadata of Deezer was used', async () => {
    setup(round(), analysis({ lookup: 'metadata' }));
    expect(await screen.findByText(/Only Deezer's titles and albums were used/)).toBeVisible();
  });

  it('offers a round about the film for film music, and not for plain music', async () => {
    const dispatch = setup(round());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Guess the film or series instead' }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: 'roundTypeChanged',
      key: 'r1',
      roundType: 'screen',
      catalog,
    });
  });

  it('does not push a round on ordinary music, but lets the host choose one anyway', async () => {
    const dispatch = setup(round(), analysis({ kind: 'music' }));
    await screen.findByText(/Looks like regular music/);
    expect(screen.queryByRole('button', { name: /instead/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guess the video game anyway' }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'roundTypeChanged',
      key: 'r1',
      roundType: 'game',
      catalog,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Guess the film or series anyway' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'roundTypeChanged',
      key: 'r1',
      roundType: 'screen',
      catalog,
    });
  });

  it('lets the host review and correct the films of a film round', async () => {
    const dispatch = setup(screenRound());
    const frozen = await screen.findByLabelText('Film or series of Let It Go');
    expect(frozen).toHaveValue('Frozen');
    expect(screen.getByLabelText('Film or series of Roar')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Guess the film/ })).not.toBeInTheDocument();

    await userEvent.type(frozen, '2');
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'sourceOverridden',
      key: 'r1',
      trackId: '1',
      name: 'Frozen2',
    });
  });

  it('leaves a track out when its film is emptied, and shows corrections', async () => {
    const dispatch = setup(screenRound({ sourceOverrides: { '1': null, '2': 'Cars' } }));
    expect(await screen.findByLabelText('Film or series of Let It Go')).toHaveValue('');
    expect(screen.getByLabelText('Film or series of Roar')).toHaveValue('Cars');

    await userEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0]!);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'sourceOverrideReset',
      key: 'r1',
      trackId: '1',
    });
  });

  it('only resets what was corrected', async () => {
    setup(screenRound({ sourceOverrides: { '2': 'Cars' } }));
    await screen.findByLabelText('Film or series of Roar');
    const [first, second] = screen.getAllByRole('button', { name: 'Reset' });
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();
  });

  it('shows the error when the lookup fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'MUSIC_CATALOG_UNAVAILABLE', message: 'Deezer is down' }),
        {
          status: 503,
        },
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SourceReview access={access} round={round()} catalog={catalog} dispatch={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Deezer is down');
  });

  describe('when nothing was detected', () => {
    const nothing = analysis({
      kind: 'music',
      tracks: [
        { id: '1', title: 'Gerudo Valley', artist: 'Koji Kondo', source: null },
        { id: '2', title: 'Green Hill Zone', artist: 'Masato Nakamura', source: null },
        { id: '3', title: 'Hateful', artist: 'Someone', source: null },
      ],
    });
    const gameRound = (overrides: Partial<EditorRound> = {}) =>
      round({ type: 'game', rules: catalog.presets.game, ...overrides });

    it('shows the list already open, so the host can name the games', async () => {
      setup(gameRound(), nothing);
      expect(await screen.findByLabelText('Video game of Gerudo Valley')).toBeVisible();
      expect(
        screen.getByText('Video games of the tracks (0 tracks with one)').closest('details'),
      ).toHaveAttribute('open');
    });

    it('names every track without a game in one go', async () => {
      const dispatch = setup(gameRound({ sourceOverrides: { '2': 'Sonic' } }), nothing);
      await userEvent.type(
        await screen.findByLabelText('Video game for every track without one'),
        'Mario',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 tracks' }));

      expect(dispatch).toHaveBeenCalledWith({
        type: 'sourcesFilled',
        key: 'r1',
        trackIds: ['1', '3'],
        name: 'Mario',
      });
    });

    it('leaves out the tracks the host excluded on purpose', async () => {
      const dispatch = setup(gameRound({ sourceOverrides: { '3': null } }), nothing);
      await userEvent.type(
        await screen.findByLabelText('Video game for every track without one'),
        'Mario',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 tracks' }));
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ trackIds: ['1', '2'] }));
    });

    it('needs a name, and tracks to name', async () => {
      setup(gameRound(), nothing);
      const apply = await screen.findByRole('button', { name: 'Apply to 3 tracks' });
      expect(apply).toBeDisabled();
    });
  });

  describe('video games', () => {
    const gameRound = (overrides: Partial<EditorRound> = {}) =>
      round({ type: 'game', rules: catalog.presets.game, ...overrides });
    const games = analysis({
      kind: 'games',
      tracks: [
        {
          id: '1',
          title: 'Gerudo Valley',
          artist: 'Koji Kondo',
          source: { name: 'Ocarina of Time', medium: 'game' },
        },
        { id: '2', title: 'Roar', artist: 'Katy Perry', source: null },
      ],
    });

    it('offers a round about the video game for video game music', async () => {
      const dispatch = setup(round(), games);
      await userEvent.click(
        await screen.findByRole('button', { name: 'Guess the video game instead' }),
      );
      expect(dispatch).toHaveBeenCalledWith({
        type: 'roundTypeChanged',
        key: 'r1',
        roundType: 'game',
        catalog,
      });
    });

    it('offers the film round instead when a game round holds film music', async () => {
      setup(gameRound(), analysis({ kind: 'movies' }));
      expect(
        await screen.findByRole('button', { name: 'Guess the film or series instead' }),
      ).toBeVisible();
    });

    it('offers nothing once the matching round is chosen', async () => {
      setup(gameRound(), games);
      await screen.findByText(/Video game music detected/);
      expect(screen.queryByRole('button', { name: /instead/ })).not.toBeInTheDocument();
    });

    it('words the review of a video game round with games', async () => {
      setup(gameRound(), games);
      expect(await screen.findByLabelText('Video game of Gerudo Valley')).toHaveValue(
        'Ocarina of Time',
      );
      expect(screen.getByText('Video games of the tracks (1 track with one)')).toBeInTheDocument();
    });
  });
});
