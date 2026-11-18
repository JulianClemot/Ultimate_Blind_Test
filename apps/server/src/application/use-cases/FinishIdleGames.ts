import type { FinishIdleGamesUseCase } from '../ports/in';
import type { Clock, GameEventPublisher, GameRepository } from '../ports/out';

/** Parties nobody touched for this long are over: the host left without ending them. */
export const IDLE_GAME_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export class FinishIdleGames implements FinishIdleGamesUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
    private readonly timeoutMs: number = IDLE_GAME_TIMEOUT_MS,
  ) {}

  async execute(): Promise<number> {
    const idle = await this.games.findIdleSince(this.clock.now() - this.timeoutMs);
    let closed = 0;
    for (const game of idle) {
      if (!game.close().ok) continue;
      await this.games.save(game);
      this.events.gameFinished(game);
      closed += 1;
    }
    return closed;
  }
}
