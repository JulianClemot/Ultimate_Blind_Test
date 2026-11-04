import type {
  AnswerDto,
  GameRecapDto,
  GameSnapshotDto,
  HostSongDto,
  PlayerDto,
  RevealDto,
  ScoreDto,
} from '@ubt/shared';

/** Pure state transitions of the host screen — easy to unit test. */

export type HostGameState = GameSnapshotDto | null;

export type HostGameAction =
  | { type: 'attached'; snapshot: GameSnapshotDto }
  | { type: 'playerJoined'; player: PlayerDto }
  | { type: 'songStarted'; song: HostSongDto }
  | { type: 'answerReceived'; answer: AnswerDto }
  | { type: 'answerJudged'; answer: AnswerDto }
  | { type: 'songRevealed'; reveal: RevealDto }
  | { type: 'scoreboardUpdated'; scoreboard: readonly ScoreDto[] }
  | { type: 'gameFinished'; scoreboard: readonly ScoreDto[] }
  | { type: 'recapReceived'; recap: GameRecapDto };

const byArrival = (a: AnswerDto, b: AnswerDto) => a.receivedAt - b.receivedAt;

const isLastSong = (state: GameSnapshotDto, song: HostSongDto) =>
  song.roundNumber === state.rounds.length && song.number === song.songCount;

export const hostGameReducer = (state: HostGameState, action: HostGameAction): HostGameState => {
  if (action.type === 'attached') return action.snapshot;
  if (!state) return state;

  switch (action.type) {
    case 'playerJoined':
      return state.players.some((p) => p.id === action.player.id)
        ? state
        : {
            ...state,
            players: [...state.players, action.player],
            scoreboard: [
              ...state.scoreboard,
              { playerId: action.player.id, playerName: action.player.name, points: 0 },
            ],
          };
    case 'songStarted':
      return state.currentSong?.id === action.song.id
        ? state
        : {
            ...state,
            status: 'playing',
            currentSong: action.song,
            reveal: null,
            answers: [],
            hasNextSong: !isLastSong(state, action.song),
          };
    case 'answerReceived':
      if (action.answer.songId !== state.currentSong?.id) return state;
      if (state.answers.some((a) => a.id === action.answer.id)) return state;
      return { ...state, answers: [...state.answers, action.answer].sort(byArrival) };
    case 'answerJudged':
      return {
        ...state,
        answers: state.answers.map((a) => (a.id === action.answer.id ? action.answer : a)),
      };
    case 'songRevealed':
      if (state.currentSong?.id !== action.reveal.songId) return state;
      return {
        ...state,
        currentSong: { ...state.currentSong, revealed: true },
        reveal: action.reveal,
        scoreboard: action.reveal.scoreboard,
      };
    case 'scoreboardUpdated':
      return {
        ...state,
        scoreboard: action.scoreboard,
        reveal: state.reveal && { ...state.reveal, scoreboard: action.scoreboard },
      };
    case 'gameFinished':
      return { ...state, status: 'finished', scoreboard: action.scoreboard, hasNextSong: false };
    case 'recapReceived':
      return { ...state, recap: action.recap };
  }
};
