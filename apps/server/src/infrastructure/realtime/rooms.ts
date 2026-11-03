/** Socket.IO room naming, shared by the publisher and the handlers. */
export const rooms = {
  game: (gameId: string) => `game:${gameId}`,
  hosts: (gameId: string) => `game:${gameId}:hosts`,
  /** Every socket of one player (several tabs or a reconnection). */
  player: (gameId: string, playerId: string) => `game:${gameId}:player:${playerId}`,
};
