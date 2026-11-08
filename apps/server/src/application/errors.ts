import type { GameError } from '../domain';

export type ApplicationErrorCode =
  | 'GAME_NOT_FOUND'
  | 'NOT_HOST'
  | 'CODE_GENERATION_FAILED'
  | 'DESIGN_NOT_FOUND'
  | 'NOT_DESIGN_OWNER'
  | 'PLAYLIST_NOT_FOUND'
  | 'PLAYLIST_EXHAUSTED'
  | 'MUSIC_CATALOG_UNAVAILABLE'
  | 'NO_SOURCE_TRACKS';

export interface ApplicationFailure {
  readonly code: ApplicationErrorCode;
  readonly message: string;
}

/** Every error a use case can return: domain rule violations or application failures. */
export type UseCaseError = GameError | ApplicationFailure;

export const appError = (code: ApplicationErrorCode, message: string): ApplicationFailure => ({
  code,
  message,
});

export const gameNotFound = (): ApplicationFailure => appError('GAME_NOT_FOUND', 'Game not found');
export const notHost = (): ApplicationFailure => appError('NOT_HOST', 'Only the host can do this');
