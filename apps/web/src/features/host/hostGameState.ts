import type {
  AnswerDto,
  EliminationDto,
  GameRecapDto,
  GameSnapshotDto,
  HostSongDto,
  PlayerDto,
  RevealDto,
  ScoreDto,
  TeamDto,
  TeamScoreDto,
} from '@ubt/shared';

/** Pure state transitions of the host screen — easy to unit test. */

export type HostGameState = GameSnapshotDto | null;

export type HostGameAction =
  | { type: 'attached'; snapshot: GameSnapshotDto }
  | { type: 'playerJoined'; player: PlayerDto }
  | { type: 'playerKicked'; playerId: string }
  | { type: 'teamsUpdated'; teams: readonly TeamDto[] }
  | { type: 'teamScoresUpdated'; teamScoreboard: readonly TeamScoreDto[] }
  | { type: 'songStarted'; song: HostSongDto }
  | { type: 'answerReceived'; answer: AnswerDto }
  | { type: 'answerJudged'; answer: AnswerDto }
  | { type: 'allAnswered'; songId: string }
  | { type: 'songRevealed'; reveal: RevealDto }
  | { type: 'scoreboardUpdated'; scoreboard: readonly ScoreDto[] }
  | { type: 'eliminationUpdated'; elimination: EliminationDto }
  | { type: 'gameFinished'; scoreboard: readonly ScoreDto[] }
  | { type: 'recapReceived'; recap: GameRecapDto };

const byArrival = (a: AnswerDto, b: AnswerDto) => a.receivedAt - b.receivedAt;

/**
 * A last-standing round in the final round of the game is won once one player is left: nothing
 * follows. (Elsewhere the next round simply starts.)
 */
const isWon = (state: GameSnapshotDto, { elimination }: Pick<RevealDto, 'elimination'>): boolean =>
  elimination !== null &&
  elimination.remaining.length <= 1 &&
  elimination.roundNumber === state.rounds.length;

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
    case 'playerKicked':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.playerId),
        scoreboard: state.scoreboard.filter((s) => s.playerId !== action.playerId),
        answers: state.answers.filter((a) => a.playerId !== action.playerId),
      };
    case 'teamsUpdated':
      return { ...state, teams: action.teams };
    case 'teamScoresUpdated':
      return { ...state, teamScoreboard: action.teamScoreboard };
    case 'songStarted':
      return state.currentSong?.id === action.song.id
        ? state
        : {
            ...state,
            status: 'playing',
            currentSong: action.song,
            reveal: null,
            answers: [],
            everyoneAnswered: false,
            elimination: action.song.elimination,
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
        teamScoreboard: action.reveal.teamScoreboard,
        elimination: action.reveal.elimination,
        hasNextSong: state.hasNextSong && !isWon(state, action.reveal),
      };
    case 'eliminationUpdated':
      return {
        ...state,
        elimination: action.elimination,
        hasNextSong: !isWon(state, { elimination: action.elimination }),
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
