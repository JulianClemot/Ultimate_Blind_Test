import type { ClientToServerEvents, ServerToClientEvents } from '@ubt/shared';
import { io, type Socket } from 'socket.io-client';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Same origin by default: the Vite dev server proxies /socket.io to the backend. */
export const createGameSocket = (): GameSocket =>
  io(import.meta.env.VITE_SOCKET_URL ?? '/', { transports: ['websocket'] });
