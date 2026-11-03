import type {
  AnswerDto,
  GameSnapshotDto,
  HostSongDto,
  PlayerSessionDto,
  RoundCatalogDto,
  RoundRulesDto,
} from '@ubt/shared';

const rules = (overrides: Partial<RoundRulesDto> = {}): RoundRulesDto => ({
  scoring: 'first',
  songCount: 10,
  titlePoints: 1,
  artistPoints: 1,
  bothBonus: 0,
  speedBonus: 0,
  answerTimeSec: 30,
  excerptSec: 30,
  playbackRate: 1,
  ...overrides,
});

export const catalog: RoundCatalogDto = {
  presets: {
    classic: rules(),
    everyone: rules({ scoring: 'everyone', titlePoints: 2, artistPoints: 2, speedBonus: 3 }),
    flash: rules({ excerptSec: 4, answerTimeSec: 20 }),
    'fast-forward': rules({ playbackRate: 2 }),
  },
  limits: {
    songCount: { min: 1, max: 50 },
    titlePoints: { min: 0, max: 100 },
    artistPoints: { min: 0, max: 100 },
    bothBonus: { min: 0, max: 100 },
    speedBonus: { min: 0, max: 100 },
    answerTimeSec: { min: 5, max: 120 },
    excerptSec: { min: 1, max: 30 },
  },
  playbackRates: [1, 1.25, 1.5, 2],
  maxRounds: 3,
};

export const hostSong = (overrides: Partial<HostSongDto> = {}): HostSongDto => ({
  id: 's1',
  roundNumber: 1,
  roundName: '',
  roundType: 'classic',
  number: 1,
  songCount: 2,
  startedAt: 1_000,
  answerTimeSec: 30,
  asksTitle: true,
  asksArtist: true,
  revealed: false,
  previewUrl: 'https://cdn.test/1.mp3',
  excerptSec: 30,
  playbackRate: 1,
  ...overrides,
});

export const answer = (overrides: Partial<AnswerDto> = {}): AnswerDto => ({
  id: 'a1',
  songId: 's1',
  playerId: 'p1',
  playerName: 'Alice',
  text: 'Song',
  receivedAt: 2_000,
  elapsedMs: 1_000,
  clientSentAt: 2_000,
  verdict: { title: false, artist: false },
  judgedByHost: false,
  ...overrides,
});

export const snapshot = (overrides: Partial<GameSnapshotDto> = {}): GameSnapshotDto => ({
  id: 'g1',
  code: 'ABCDEF',
  name: 'Friday night',
  status: 'lobby',
  players: [{ id: 'p1', name: 'Alice' }],
  rounds: [
    {
      number: 1,
      name: '',
      type: 'classic',
      songCount: 2,
      rules: { ...catalog.presets.classic, songCount: 2 },
    },
    {
      number: 2,
      name: '',
      type: 'flash',
      songCount: 1,
      rules: { ...catalog.presets.flash, songCount: 1 },
    },
  ],
  currentSong: null,
  reveal: null,
  answers: [],
  scoreboard: [{ playerId: 'p1', playerName: 'Alice', points: 0 }],
  hasNextSong: true,
  ...overrides,
});

export const playerSession = (overrides: Partial<PlayerSessionDto> = {}): PlayerSessionDto => ({
  gameId: 'g1',
  code: 'ABCDEF',
  name: 'Friday night',
  status: 'lobby',
  player: { id: 'p1', name: 'Alice' },
  rounds: snapshot().rounds,
  currentSong: null,
  reveal: null,
  myAnswers: [],
  scoreboard: [],
  ...overrides,
});
