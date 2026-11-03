export type GameErrorCode =
  | 'INVALID_GAME_CODE'
  | 'INVALID_PLAYER_NAME'
  | 'PLAYER_NAME_TAKEN'
  | 'GAME_FULL'
  | 'GAME_FINISHED'
  | 'UNKNOWN_PLAYER'
  | 'NO_ACTIVE_SONG'
  | 'SONG_IN_PROGRESS'
  | 'SONG_CLOSED'
  | 'SONG_ALREADY_REVEALED'
  | 'ALREADY_FOUND'
  | 'TOO_MANY_ATTEMPTS'
  | 'INVALID_ANSWER'
  | 'UNKNOWN_ANSWER'
  | 'INVALID_PLAYLIST'
  | 'INVALID_DESIGN_NAME'
  | 'INVALID_ROUND_RULES'
  | 'INVALID_ROUND_NAME'
  | 'TOO_MANY_ROUNDS'
  | 'EMPTY_DESIGN';

export interface GameError {
  readonly code: GameErrorCode;
  readonly message: string;
}

export const gameError = (code: GameErrorCode, message: string): GameError => ({ code, message });
