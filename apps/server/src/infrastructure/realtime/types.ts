import type { ClientToServerEvents, ServerToClientEvents } from '@ubt/shared';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';

/** What the server remembers about a connection once it identified itself. */
export type SocketSession =
  | { readonly role: 'host'; readonly gameId: string; readonly hostToken: string }
  | { readonly role: 'player'; readonly gameId: string; readonly playerId: string };

export interface SocketData {
  session?: SocketSession;
}

/** No server-to-server events yet (would be used with a multi-node adapter). */
type NoInterServerEvents = DefaultEventsMap;

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  NoInterServerEvents,
  SocketData
>;
export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  NoInterServerEvents,
  SocketData
>;
