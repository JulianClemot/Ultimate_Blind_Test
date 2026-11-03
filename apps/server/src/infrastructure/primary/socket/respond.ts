import type { AckResponse } from '@ubt/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';

import type { Result } from '../../../domain';
import type { UseCaseError } from '../../../application';
import { toErrorDto } from '../../mappers/errorMappers';

export const failure = (code: string, message: string): AckResponse<never> => ({
  ok: false,
  error: { code, message },
});

export const notIdentified = (): AckResponse<never> =>
  failure('NOT_IDENTIFIED', 'Join or attach to a game first');

/** Maps a use case result to an ack response. */
export const fromResult = <T, D>(
  result: Result<T, UseCaseError>,
  toDto: (value: T) => D,
): AckResponse<D> =>
  result.ok
    ? { ok: true, data: toDto(result.value) }
    : { ok: false, error: toErrorDto(result.error) };

export type Parsed<T> = { ok: true; value: T } | { ok: false; response: AckResponse<never> };

export const parsePayload = <S extends z.ZodType>(
  schema: S,
  payload: unknown,
): Parsed<z.output<S>> => {
  const parsed = schema.safeParse(payload);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, response: failure('INVALID_PAYLOAD', parsed.error.message) };
};

/**
 * Runs a handler and always answers the ack exactly once, even on unexpected
 * errors. Clients that did not provide an ack callback are ignored.
 */
export const respond = async <D>(
  ack: unknown,
  logger: FastifyBaseLogger,
  work: () => Promise<AckResponse<D>>,
): Promise<void> => {
  if (typeof ack !== 'function') return;
  const reply = ack as (response: AckResponse<D>) => void;
  try {
    reply(await work());
  } catch (error) {
    logger.error({ err: error }, 'Socket handler failed');
    reply(failure('INTERNAL_ERROR', 'Unexpected server error'));
  }
};
