import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { hostSong } from '@/test/fixtures';

import { SongPanel } from './SongPanel';

const handlers = () => ({ onNext: vi.fn(), onReveal: vi.fn(), onReplay: vi.fn(), onStop: vi.fn() });

describe('<SongPanel />', () => {
  it('offers to play the first song', async () => {
    const props = handlers();
    render(
      <SongPanel song={null} reveal={null} roundCount={2} hasNextSong pending={false} {...props} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Play the first song' }));
    expect(props.onNext).toHaveBeenCalled();
  });

  it('shows the song position and a countdown while it is open', () => {
    vi.useFakeTimers({ now: 11_000 });
    render(
      <SongPanel
        song={hostSong({ startedAt: 1_000, answerTimeSec: 30 })}
        reveal={null}
        roundCount={2}
        hasNextSong
        pending={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('Round 1/2 · Classic')).toBeInTheDocument();
    expect(screen.getByText('Song 1/2')).toBeInTheDocument();
    expect(screen.getByLabelText('Seconds left')).toHaveTextContent('20');
    expect(screen.getByRole('button', { name: 'Reveal now' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows the round name instead of its type when it has one', () => {
    render(
      <SongPanel
        song={hostSong({ roundName: 'Daft Punk hour', revealed: true })}
        reveal={null}
        roundCount={2}
        hasNextSong
        pending={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('Round 1/2 · Daft Punk hour')).toBeInTheDocument();
  });

  it('reveals automatically once, when time is up', () => {
    vi.useFakeTimers({ now: 100_000 });
    const props = handlers();
    const { rerender } = render(
      <SongPanel
        song={hostSong()}
        reveal={null}
        roundCount={2}
        hasNextSong
        pending={false}
        {...props}
      />,
    );
    rerender(
      <SongPanel song={hostSong()} reveal={null} roundCount={2} hasNextSong pending {...props} />,
    );
    expect(props.onReveal).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows the answer after the reveal and the final step on the last song', () => {
    render(
      <SongPanel
        song={hostSong({ revealed: true })}
        reveal={{ songId: 's1', title: 'One More Time', artist: 'Daft Punk', scoreboard: [] }}
        roundCount={2}
        hasNextSong={false}
        pending={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('One More Time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show final scores' })).toBeInTheDocument();
  });
});
