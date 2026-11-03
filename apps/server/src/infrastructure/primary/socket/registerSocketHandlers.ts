import type { FastifyBaseLogger } from 'fastify';

import type { GameServer } from '../../realtime/types';
import { registerHostHandlers, type HostUseCases } from './hostHandlers';
import { registerPlayerHandlers, type PlayerUseCases } from './playerHandlers';

export type SocketUseCases = HostUseCases & PlayerUseCases;

export const registerSocketHandlers = (
  io: GameServer,
  useCases: SocketUseCases,
  logger: FastifyBaseLogger,
): void => {
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected');
    registerHostHandlers(socket, useCases, logger);
    registerPlayerHandlers(socket, useCases, logger);
    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });
};
