import type {
  AnswerDto,
  GameRecapDto,
  PlayerSessionDto,
  RevealDto,
  ScoreDto,
  SongDto,
} from '@ubt/shared';

/** Pure state transitions of the player screen — easy to unit test. */

export type PlayerGameState = PlayerSessionDto | null;

export type PlayerGameAction =
  | { type: 'rejoined'; session: PlayerSessionDto }
  | { type: 'songStarted'; song: SongDto }
  | { type: 'answerSent'; answer: AnswerDto }
  | { type: 'answerJudged'; answer: AnswerDto }
  | { type: 'allAnswered'; songId: string }
  | { type: 'songRevealed'; reveal: RevealDto }
  | { type: 'scoreboardUpdated'; scoreboard: readonly ScoreDto[] }
  | { type: 'gameFinished'; scoreboard: readonly ScoreDto[] }
  | { type: 'recapReceived'; recap: GameRecapDto };

export const playerGameReducer = (
  state: PlayerGameState,
  action: PlayerGameAction,
): PlayerGameState => {
  if (action.type === 'rejoined') return action.session;
  if (!state) return state;

  switch (action.type) {
    case 'songStarted':
      return state.currentSong?.id === action.song.id
        ? state
        : {
            ...state,
            status: 'playing',
            currentSong: action.song,
            reveal: null,
            myAnswers: [],
            everyoneAnswered: false,
          };
    case 'answerSent':
      if (action.answer.songId !== state.currentSong?.id) return state;
      if (state.myAnswers.some((a) => a.id === action.answer.id)) return state;
      return { ...state, myAnswers: [...state.myAnswers, action.answer] };
    case 'answerJudged':
      return {
        ...state,
        myAnswers: state.myAnswers.map((a) => (a.id === action.answer.id ? action.answer : a)),
      };
    case 'allAnswered':
      return state.currentSong?.id === action.songId ? { ...state, everyoneAnswered: true } : state;
    case 'songRevealed':
      if (state.currentSong?.id !== action.reveal.songId) return state;
      return {
        ...state,
        everyoneAnswered: false,
        currentSong: { ...state.currentSong, revealed: true },
        reveal: action.reveal,
        scoreboard: action.reveal.scoreboard,
      };
    case 'scoreboardUpdated':
      return { ...state, scoreboard: action.scoreboard };
    case 'gameFinished':
      return { ...state, status: 'finished', scoreboard: action.scoreboard };
    case 'recapReceived':
      return { ...state, recap: action.recap };
  }
};

/** What the player found with their answer to the current song. */
export const foundParts = (answers: readonly AnswerDto[]) => ({
  title: answers.some((a) => a.verdict.title),
  artist: answers.some((a) => a.verdict.artist),
});
