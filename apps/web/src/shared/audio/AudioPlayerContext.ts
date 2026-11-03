import { createContext, use } from 'react';

import { createHowlerAudioPlayer, type AudioPlayer } from './audioPlayer';

export const AudioPlayerContext = createContext<AudioPlayer>(createHowlerAudioPlayer());

export const useAudioPlayer = (): AudioPlayer => use(AudioPlayerContext);
