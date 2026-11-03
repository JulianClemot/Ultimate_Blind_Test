import type { ErrorDto } from '@ubt/shared';

import type { UseCaseError } from '../../application';

export const toErrorDto = (error: UseCaseError): ErrorDto => ({
  code: error.code,
  message: error.message,
});

const HTTP_STATUS: Partial<Record<UseCaseError['code'], number>> = {
  GAME_NOT_FOUND: 404,
  DESIGN_NOT_FOUND: 404,
  PLAYLIST_NOT_FOUND: 404,
  NOT_HOST: 403,
  NOT_DESIGN_OWNER: 403,
  CODE_GENERATION_FAILED: 503,
  MUSIC_CATALOG_UNAVAILABLE: 503,
};

export const toHttpStatus = (error: UseCaseError): number => HTTP_STATUS[error.code] ?? 422;
