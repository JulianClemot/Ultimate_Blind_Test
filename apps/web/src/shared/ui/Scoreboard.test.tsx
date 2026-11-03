import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Scoreboard } from './Scoreboard';

describe('<Scoreboard />', () => {
  it('ranks players, ties sharing a rank', () => {
    render(
      <Scoreboard
        scores={[
          { playerId: 'a', playerName: 'Alice', points: 5 },
          { playerId: 'b', playerName: 'Bob', points: 5 },
          { playerId: 'c', playerName: 'Carol', points: 2 },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1.Alice5 pts',
      '1.Bob5 pts',
      '3.Carol2 pts',
    ]);
  });
});
