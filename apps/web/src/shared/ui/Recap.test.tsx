import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as shareCard from '@/shared/lib/shareCard';
import { gameRecap } from '@/test/fixtures';

import { Recap } from './Recap';

vi.mock('@/shared/lib/shareCard', async (importOriginal) => ({
  ...(await importOriginal<typeof shareCard>()),
  renderShareCard: vi.fn(),
  shareImage: vi.fn(),
}));

describe('<Recap />', () => {
  beforeEach(() => {
    vi.mocked(shareCard.renderShareCard).mockResolvedValue(new Blob(['png']));
    vi.mocked(shareCard.shareImage).mockResolvedValue('shared');
  });

  it('shows the podium with the three best players', () => {
    render(<Recap recap={gameRecap()} />);

    const podium = screen.getByRole('list', { name: 'Podium' });
    expect(
      within(podium)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('Bob') as unknown,
      expect.stringContaining('Alice') as unknown,
      expect.stringContaining('Chloé') as unknown,
    ]);
    expect(within(podium).getByText('Alice').closest('li')).toHaveTextContent('5 pts');
  });

  it('lists the full ranking, ties sharing a rank', () => {
    render(<Recap recap={gameRecap()} />);

    const ranking = screen.getByRole('list', { name: 'Scoreboard' });
    expect(
      within(ranking)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1.Alice5 pts', '2.Bob3 pts', '2.Chloé3 pts', '4.Dan0 pts']);
  });

  it('gives each award to its winner', () => {
    render(<Recap recap={gameRecap()} />);

    const awards = screen.getByRole('list', { name: 'Awards' });
    const items = within(awards).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Fastest finger');
    expect(items[0]).toHaveTextContent('Alice');
    expect(items[0]).toHaveTextContent('2.3 s on average');
    expect(items[2]).toHaveTextContent('Stubborn');
    expect(items[2]).toHaveTextContent('Bob');
    expect(items[2]).toHaveTextContent('4 wrong guesses');
  });

  it('has no awards section when nobody earned one', () => {
    render(<Recap recap={gameRecap({ superlatives: [] })} />);

    expect(screen.queryByRole('list', { name: 'Awards' })).not.toBeInTheDocument();
  });

  it('tells a player how they finished', () => {
    render(<Recap recap={gameRecap()} playerId="p2" />);

    expect(screen.getByText('You finished #2 with 3 pts')).toBeInTheDocument();
  });

  it('replays the songs, with who found them and how fast', async () => {
    render(<Recap recap={gameRecap()} />);

    const song = screen.getByText(/One More Time/).closest('details');
    expect(song).not.toBeNull();
    expect(song).toHaveTextContent('Daft Punk');
    await userEvent.click(screen.getByText(/One More Time/));

    const results = within(song as HTMLElement).getAllByRole('listitem');
    expect(results[0]).toHaveTextContent('Alice');
    expect(results[0]).toHaveTextContent('1.5 s');
    expect(results[0]).toHaveTextContent('+2');
    expect(results[1]).toHaveTextContent('Bob');
    expect(results[1]).toHaveTextContent('title only');
    expect(results[1]).toHaveTextContent('2 wrong');
    expect(results[2]).toHaveTextContent('Dan');
    expect(results[2]).toHaveTextContent('missed it');
  });

  describe('share', () => {
    it('shares an image of the results', async () => {
      render(<Recap recap={gameRecap()} playerId="p1" />);

      await userEvent.click(screen.getByRole('button', { name: /share/i }));

      expect(shareCard.renderShareCard).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Friday night',
          highlight: '⚡ Fastest finger · 2.3 s on average',
        }),
      );
      expect(shareCard.shareImage).toHaveBeenCalledWith(expect.any(Blob), 'Friday night');
    });

    it('says when the image was downloaded instead', async () => {
      vi.mocked(shareCard.shareImage).mockResolvedValue('downloaded');
      render(<Recap recap={gameRecap()} />);

      await userEvent.click(screen.getByRole('button', { name: /share/i }));

      expect(await screen.findByText(/image downloaded/i)).toBeInTheDocument();
    });

    it('reports a failure to build the image', async () => {
      vi.mocked(shareCard.renderShareCard).mockRejectedValue(new Error('no canvas'));
      render(<Recap recap={gameRecap()} />);

      await userEvent.click(screen.getByRole('button', { name: /share/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('no canvas');
    });
  });

  describe('team ranking', () => {
    const teamStandings = [
      { rank: 1, teamId: 'team-1', teamName: 'The Funky Flamingos', points: 7 },
      { rank: 2, teamId: 'team-2', teamName: 'The Neon Llamas', points: 4 },
    ];

    it('is shown when rounds were played in team mode', () => {
      render(<Recap recap={gameRecap({ teamStandings })} teamId="team-2" />);

      const ranking = screen.getByRole('list', { name: 'Team scoreboard' });
      expect(ranking).toHaveTextContent('1.The Funky Flamingos7 pts');
      expect(ranking).toHaveTextContent('2.The Neon Llamas4 pts');
      expect(within(ranking).getByText('The Neon Llamas').closest('li')).toHaveClass(
        'font-semibold',
      );
    });

    it('is left out otherwise', () => {
      render(<Recap recap={gameRecap()} />);
      expect(screen.queryByRole('list', { name: 'Team scoreboard' })).not.toBeInTheDocument();
    });
  });
});

describe('<Recap /> with films and series', () => {
  it('names the film of a song and does not call a found film "title only"', async () => {
    const recap = gameRecap();
    const [first, ...others] = recap.songs;
    if (!first) throw new Error('fixture');
    const [alice, ...rest] = first.results;
    render(
      <Recap
        recap={{
          ...recap,
          songs: [
            {
              ...first,
              source: 'Frozen',
              results: [{ ...alice!, foundTitle: false, foundSource: true }, ...rest],
            },
            ...others,
          ],
        }}
      />,
    );

    const song = screen.getByText(/One More Time/).closest('details');
    expect(song).toHaveTextContent('Frozen');
    await userEvent.click(screen.getByText(/One More Time/));
    const results = within(song as HTMLElement).getAllByRole('listitem');
    expect(results[0]).toHaveTextContent('Alice');
    expect(results[0]).not.toHaveTextContent(/title only|artist only/);
  });
});
