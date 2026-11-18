import {
  gameStatusQuerySchema,
  launchGamePayloadSchema,
  type CreateGameResponseDto,
  type GameStatusResponseDto,
} from '@ubt/shared';
import type { FastifyInstance } from 'fastify';

import type { GetGameStatusUseCase, LaunchGameUseCase } from '../../../application';
import { parseOr400, sendResult } from './httpHelpers';

export interface GameRoutesUseCases {
  readonly launchGame: LaunchGameUseCase;
  readonly getGameStatus: GetGameStatusUseCase;
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

  /** Whether a party a player belongs to is still on (`?playerId=`), without joining it. */
  app.get('/api/games/:gameId/status', async (request, reply) => {
    const query = parseOr400(gameStatusQuerySchema, request.query, reply);
    if (!query) return reply;
    const { gameId } = request.params as { gameId: string };
    const result = await useCases.getGameStatus.execute({ gameId, playerId: query.playerId });
    return sendResult(reply, result, (status): GameStatusResponseDto => ({ status }));
  });
};
