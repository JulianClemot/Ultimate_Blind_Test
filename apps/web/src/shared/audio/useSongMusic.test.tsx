import type { HostSongDto } from '@ubt/shared';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AudioPlayer } from './audioPlayer';
import { AudioPlayerContext } from './AudioPlayerContext';
import { useSongMusic } from './useSongMusic';

const song = (overrides: Partial<HostSongDto> = {}): HostSongDto => ({
  id: 's1',
  roundNumber: 1,
  roundName: '',
  roundType: 'classic',
  number: 1,
  songCount: 10,
  startedAt: 0,
  answerTimeSec: 30,
  asksTitle: true,
  asksArtist: true,
  revealed: false,
  previewUrl: 'https://cdn.test/1.mp3',
  excerptSec: 30,
  playbackRate: 1,
  ...overrides,
});

const setup = (initial: HostSongDto | null) => {
  const player: AudioPlayer = { play: vi.fn(), stop: vi.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AudioPlayerContext value={player}>{children}</AudioPlayerContext>
  );
  const hook = renderHook(({ current }) => useSongMusic(current), {
    wrapper,
    initialProps: { current: initial },
  });
  return { player, play: vi.mocked(player.play), ...hook };
};

describe('useSongMusic', () => {
  it('stays silent without a song', () => {
    expect(setup(null).play).not.toHaveBeenCalled();
  });

  it('plays each new song once, the whole preview at normal speed for classic rounds', () => {
    const { play, rerender } = setup(song());
    rerender({ current: song() });
    rerender({ current: song({ id: 's2', previewUrl: 'https://cdn.test/2.mp3' }) });
    expect(play.mock.calls).toEqual([
      ['https://cdn.test/1.mp3', { rate: 1 }],
      ['https://cdn.test/2.mp3', { rate: 1 }],
    ]);
  });

  it('plays only the excerpt, at the round speed', () => {
    const { play } = setup(song({ excerptSec: 4, playbackRate: 2 }));
    expect(play).toHaveBeenCalledWith('https://cdn.test/1.mp3', { rate: 2, durationSec: 2 });
  });

  it('replays an altered song normally at the reveal, but not a classic one', () => {
    const flash = setup(song({ excerptSec: 4 }));
    flash.rerender({ current: song({ excerptSec: 4, revealed: true }) });
    expect(flash.play).toHaveBeenLastCalledWith('https://cdn.test/1.mp3');

    const classic = setup(song());
    classic.rerender({ current: song({ revealed: true }) });
    expect(classic.play).toHaveBeenCalledTimes(1);
  });

  it('does not restart an already revealed song after a reconnection', () => {
    const { play } = setup(song({ excerptSec: 4, revealed: true }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('exposes replay and stop controls, and stops when unmounted', () => {
    const { player, play, result, unmount } = setup(song({ excerptSec: 4 }));
    act(() => result.current.replay());
    expect(play).toHaveBeenLastCalledWith('https://cdn.test/1.mp3', { rate: 1, durationSec: 4 });
    act(() => result.current.stop());
    unmount();
    expect(player.stop).toHaveBeenCalledTimes(2);
  });
});
