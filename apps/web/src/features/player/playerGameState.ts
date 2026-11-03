import type { AnswerDto, PlayerSessionDto, RevealDto, ScoreDto, SongDto } from '@ubt/shared';

/** Pure state transitions of the player screen — easy to unit test. */

export type PlayerGameState = PlayerSessionDto | null;

export type PlayerGameAction =
  | { type: 'rejoined'; session: PlayerSessionDto }
  | { type: 'songStarted'; song: SongDto }
  | { type: 'answerSent'; answer: AnswerDto }
  | { type: 'answerJudged'; answer: AnswerDto }
  | { type: 'songRevealed'; reveal: RevealDto }
  | { type: 'scoreboardUpdated'; scoreboard: readonly ScoreDto[] }
  | { type: 'gameFinished'; scoreboard: readonly ScoreDto[] };

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
        : { ...state, status: 'playing', currentSong: action.song, reveal: null, myAnswers: [] };
    case 'answerSent':
      if (action.answer.songId !== state.currentSong?.id) return state;
      if (state.myAnswers.some((a) => a.id === action.answer.id)) return state;
      return { ...state, myAnswers: [...state.myAnswers, action.answer] };
    case 'answerJudged':
      return {
        ...state,
        myAnswers: state.myAnswers.map((a) => (a.id === action.answer.id ? action.answer : a)),
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
      return { ...state, scoreboard: action.scoreboard };
    case 'gameFinished':
      return { ...state, status: 'finished', scoreboard: action.scoreboard };
  }
};

/** What the player found so far on the current song, across all their attempts. */
export const foundParts = (answers: readonly AnswerDto[]) => ({
  title: answers.some((a) => a.verdict.title),
  artist: answers.some((a) => a.verdict.artist),
});

/** True once every part the song asks for was found: no need to answer again. */
export const hasFoundEverything = (song: SongDto, answers: readonly AnswerDto[]) => {
  const found = foundParts(answers);
  return (!song.asksTitle || found.title) && (!song.asksArtist || found.artist);
};
