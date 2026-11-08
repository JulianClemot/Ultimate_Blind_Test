import {
  joinGamePayloadSchema,
  rejoinGamePayloadSchema,
  submitAnswerPayloadSchema,
} from '@ubt/shared';
import type { FastifyBaseLogger } from 'fastify';

import type {
  JoinGameUseCase,
  PlayerSession,
  RejoinGameUseCase,
  SubmitAnswerUseCase,
} from '../../../application';
import { toAnswerDto, toPlayerSessionDto } from '../../mappers/dtoMappers';
import { rooms } from '../../realtime/rooms';
import type { GameSocket } from '../../realtime/types';
import { fromResult, notIdentified, parsePayload, respond } from './respond';

export interface PlayerUseCases {
  readonly joinGame: JoinGameUseCase;
  readonly rejoinGame: RejoinGameUseCase;
  readonly submitAnswer: SubmitAnswerUseCase;
}

export const registerPlayerHandlers = (
  socket: GameSocket,
  useCases: PlayerUseCases,
  logger: FastifyBaseLogger,
): void => {
  const enterGame = async ({ game, player }: PlayerSession) => {
    socket.data.session = { role: 'player', gameId: game.id, playerId: player.id };
    await socket.join([rooms.game(game.id), rooms.player(game.id, player.id)]);
  };

  socket.on('player:join', (payload, ack) =>
    respond(ack, logger, async () => {
      const input = parsePayload(joinGamePayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.joinGame.execute(input.value);
      if (result.ok) await enterGame(result.value);
      return fromResult(result, toPlayerSessionDto);
    }),
  );

  socket.on('player:rejoin', (payload, ack) =>
    respond(ack, logger, async () => {
      const input = parsePayload(rejoinGamePayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.rejoinGame.execute(input.value);
      if (result.ok) await enterGame(result.value);
      return fromResult(result, toPlayerSessionDto);
    }),
  );

  socket.on('answer:submit', (payload, ack) =>
    respond(ack, logger, async () => {
      const session = socket.data.session;
      if (session?.role !== 'player') return notIdentified();
      const input = parsePayload(submitAnswerPayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.submitAnswer.execute({
        gameId: session.gameId,
        playerId: session.playerId,
        text: input.value.text,
        clientSentAt: input.value.clientSentAt,
        suggestionId: input.value.suggestionId,
      });
      return fromResult(result, ({ game, answer }) => toAnswerDto(game, answer));
    }),
  );
};
