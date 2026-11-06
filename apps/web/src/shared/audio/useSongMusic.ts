import type { HostSongDto } from '@ubt/shared';
import { useEffect, useRef } from 'react';

import type { AudioPlayer } from './audioPlayer';
import { useAudioPlayer } from './AudioPlayerContext';

/** The preview is 30 s long: an excerpt of 30 s means the whole clip. */
const FULL_PREVIEW_SEC = 30;

/** Plays the song as the round rules say: an excerpt of the preview, at the round speed. */
const playForRound = (player: AudioPlayer, song: HostSongDto) =>
  player.play(song.previewUrl, {
    rate: song.playbackRate,
    ...(song.excerptSec < FULL_PREVIEW_SEC
      ? { durationSec: song.excerptSec / song.playbackRate }
      : {}),
  });

/**
 * Host music: each new song plays as soon as it starts and nothing restarts it at the
 * reveal. Returns manual controls: the host replays on demand (the full song once revealed),
 * and browsers may block the automatic start, e.g. after a page refresh.
 */
export const useSongMusic = (song: HostSongDto | null) => {
  const player = useAudioPlayer();
  const playedSongId = useRef<string | null>(null);

  useEffect(() => {
    if (!song) {
      // No song any more (the game ended): whatever is still playing must stop.
      if (playedSongId.current !== null) player.stop();
      playedSongId.current = null;
      return;
    }
    if (playedSongId.current !== song.id) {
      playedSongId.current = song.id;
      playForRound(player, song);
    }
  }, [player, song]);

  useEffect(() => () => player.stop(), [player]);

  return {
    replay: () => {
      if (!song) return;
      if (song.revealed) player.play(song.previewUrl);
      else playForRound(player, song);
    },
    stop: () => player.stop(),
  };
};
