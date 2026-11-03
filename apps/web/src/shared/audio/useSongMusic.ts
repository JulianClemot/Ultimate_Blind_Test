import type { HostSongDto } from '@ubt/shared';
import { useEffect, useRef } from 'react';

import type { AudioPlayer } from './audioPlayer';
import { useAudioPlayer } from './AudioPlayerContext';

/** The preview is 30 s long: an excerpt of 30 s means the whole clip. */
const FULL_PREVIEW_SEC = 30;

const altered = (song: HostSongDto) =>
  song.excerptSec < FULL_PREVIEW_SEC || song.playbackRate !== 1;

/** Plays the song as the round rules say: an excerpt of the preview, at the round speed. */
const playForRound = (player: AudioPlayer, song: HostSongDto) =>
  player.play(song.previewUrl, {
    rate: song.playbackRate,
    ...(song.excerptSec < FULL_PREVIEW_SEC
      ? { durationSec: song.excerptSec / song.playbackRate }
      : {}),
  });

/**
 * Host music: each new song plays as soon as it starts; at the reveal, a cut or sped-up
 * song is replayed normally so everyone hears what it was. Returns manual controls
 * (browsers may block the automatic start, e.g. after a page refresh).
 */
export const useSongMusic = (song: HostSongDto | null) => {
  const player = useAudioPlayer();
  const playedSongId = useRef<string | null>(null);
  const revealedSongId = useRef<string | null>(null);

  useEffect(() => {
    if (!song) return;
    if (playedSongId.current !== song.id) {
      playedSongId.current = song.id;
      revealedSongId.current = song.revealed ? song.id : null;
      playForRound(player, song);
    } else if (song.revealed && revealedSongId.current !== song.id) {
      revealedSongId.current = song.id;
      if (altered(song)) player.play(song.previewUrl);
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
