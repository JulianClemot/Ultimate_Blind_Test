import { ok, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type {
  AutoRevealSongUseCase,
  KickPlayerCommand,
  KickPlayerUseCase,
  PlayerSession,
} from '../ports/in';
import type { GameEventPublisher, GameRepository, Scheduler } from '../ports/out';
import { loadHostedGame } from './access';
import { revealOnceEveryoneAnswered } from './revealOnceEveryoneAnswered';

/** The host removes a player, whatever the state of the game (lobby, song running, between songs). */
export class KickPlayer implements KickPlayerUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
    private readonly scheduler: Scheduler,
    private readonly autoReveal: AutoRevealSongUseCase,
  ) {}

  async execute(command: KickPlayerCommand): Promise<Result<PlayerSession, UseCaseError>> {
    const loaded = await loadHostedGame(this.games, command);
    if (!loaded.ok) return loaded;
    const game = loaded.value;

    const kicked = game.removePlayer(command.playerId);
    if (!kicked.ok) return kicked;

    await this.games.save(game);
    this.events.playerKicked(game, kicked.value);
    // Everyone's ranking (and the teams' points) lose the player.
    this.events.scoreboardUpdated(game);
    if (game.hasTeams) this.events.teamsUpdated(game);
    // The kicked player may have been the last one the song was waiting for.
    revealOnceEveryoneAnswered(game, this.events, this.scheduler, this.autoReveal);
    return ok({ game, player: kicked.value });
  }
}
