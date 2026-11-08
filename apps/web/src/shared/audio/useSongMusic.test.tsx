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
  asksSource: false,
  suggestions: [],
  previewUrl: 'https://cdn.test/1.mp3',
  excerptSec: 30,
  playbackRate: 1,
  title: 'One More Time',
  artist: 'Daft Punk',
  source: null,
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

  it('does not play anything at the reveal, whatever the round', () => {
    const flash = setup(song({ excerptSec: 4 }));
    flash.rerender({ current: song({ excerptSec: 4, revealed: true }) });
    expect(flash.play).toHaveBeenCalledTimes(1);

    const classic = setup(song());
    classic.rerender({ current: song({ revealed: true }) });
    expect(classic.play).toHaveBeenCalledTimes(1);
  });

  it('lets the host replay the full song manually once revealed', () => {
    const { play, rerender, result } = setup(song({ excerptSec: 4 }));
    rerender({ current: song({ excerptSec: 4, revealed: true }) });
    act(() => result.current.replay());
    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenLastCalledWith('https://cdn.test/1.mp3');
  });

  it('does not restart an already revealed song after a reconnection', () => {
    const { play } = setup(song({ excerptSec: 4, revealed: true }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('stops the music when the song goes away, e.g. when the game ends', () => {
    const { player, rerender } = setup(song({ revealed: true, excerptSec: 4 }));
    expect(player.stop).not.toHaveBeenCalled();

    rerender({ current: null });

    expect(player.stop).toHaveBeenCalledTimes(1);
  });

  it('plays again if the same song comes back after the music was stopped', () => {
    const { play, rerender } = setup(song());
    rerender({ current: null });
    rerender({ current: song() });
    expect(play).toHaveBeenCalledTimes(2);
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
