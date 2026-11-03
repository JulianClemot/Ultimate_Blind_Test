import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { catalog, snapshot } from '@/test/fixtures';

import { GameOverview } from './GameOverview';

describe('<GameOverview />', () => {
  it('lists every round with its name, type and rules', () => {
    const rounds = snapshot().rounds.map((round, index) => ({
      ...round,
      name: index === 0 ? 'French Touch' : '',
    }));
    render(<GameOverview rounds={rounds} />);

    const [first, second] = screen
      .getAllByRole('listitem', { name: '' })
      .filter((li) => li.querySelector('h3'));
    expect(first).toHaveTextContent('Round 1/2 · Classic');
    expect(within(first!).getByRole('heading', { name: 'French Touch' })).toBeInTheDocument();
    expect(first).toHaveTextContent('Find the title (1 point) and the artist (1 point)');
    // An unnamed round falls back to its type.
    expect(within(second!).getByRole('heading', { name: 'Flash' })).toBeInTheDocument();
    expect(second).toHaveTextContent('Only the first 4 s of each song are played');
  });

  it('renders nothing for a game without rounds', () => {
    render(<GameOverview rounds={[]} />);
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(catalog.maxRounds).toBeGreaterThan(0);
  });
});
