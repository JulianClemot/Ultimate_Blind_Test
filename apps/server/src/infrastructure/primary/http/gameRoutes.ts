import { launchGamePayloadSchema, type CreateGameResponseDto } from '@ubt/shared';
import type { FastifyInstance } from 'fastify';

import type { LaunchGameUseCase } from '../../../application';
import { parseOr400, sendResult } from './httpHelpers';

export interface GameRoutesUseCases {
  readonly launchGame: LaunchGameUseCase;
}

export const registerGameRoutes = (app: FastifyInstance, useCases: GameRoutesUseCases): void => {
  /** Launches a party from a design. */
  app.post('/api/games', async (request, reply) => {
    const body = parseOr400(launchGamePayloadSchema, request.body, reply);
    if (!body) return reply;
    const result = await useCases.launchGame.execute(body);
    return sendResult(
      reply,
      result,
      ({ game, hostToken }): CreateGameResponseDto => ({
        gameId: game.id,
        code: game.code.value,
        hostToken,
      }),
      201,
    );
  });
};
