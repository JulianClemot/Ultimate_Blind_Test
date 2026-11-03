import type { ErrorDto } from '@ubt/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { UseCaseError } from '../../../application';
import type { Result } from '../../../domain';
import { toErrorDto, toHttpStatus } from '../../mappers/errorMappers';

export const sendError = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.status(status).send({ code, message } satisfies ErrorDto);

/** Parses a body or query with a shared schema; replies 400 and returns undefined on failure. */
export const parseOr400 = <S extends z.ZodType>(
  schema: S,
  value: unknown,
  reply: FastifyReply,
): z.output<S> | undefined => {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  void sendError(reply, 400, 'INVALID_PAYLOAD', parsed.error.message);
  return undefined;
};

/** Design secrets travel as `Authorization: Bearer <editToken>`, never in URLs. */
export const bearerToken = (request: FastifyRequest): string => {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
};

export const sendResult = <T>(
  reply: FastifyReply,
  result: Result<T, UseCaseError>,
  toDto: (value: T) => unknown,
  status = 200,
) =>
  result.ok
    ? reply.status(status).send(toDto(result.value))
    : reply.status(toHttpStatus(result.error)).send(toErrorDto(result.error));
