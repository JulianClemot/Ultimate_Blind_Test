import { Howl } from 'howler';

export interface PlayOptions {
  /** Playback speed (1 = normal). */
  readonly rate?: number;
  /** Stops after this many seconds of listening; plays the whole file when omitted. */
  readonly durationSec?: number;
}

/** Port for playing round music; components never use Howler directly. */
export interface AudioPlayer {
  /** Plays `url` from the start, replacing whatever is playing. */
  play(url: string, options?: PlayOptions): void;
  stop(): void;
}

export const createHowlerAudioPlayer = (): AudioPlayer => {
  let current: Howl | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    clearTimeout(timer);
    current?.unload();
    current = null;
  };

  return {
    play(url, { rate = 1, durationSec } = {}) {
      stop();
      // html5 streams the file through an <audio> element: playback starts before
      // the whole preview is downloaded and the Deezer CDN needs no CORS headers.
      const sound = new Howl({ src: [url], format: ['mp3'], html5: true, rate });
      if (durationSec !== undefined) {
        // Count from the actual start of the sound, not from the (buffering) request.
        sound.once('play', () => {
          timer = setTimeout(() => {
            if (current === sound) stop();
          }, durationSec * 1000);
        });
      }
      current = sound;
      sound.play();
    },
    stop,
  };
};
