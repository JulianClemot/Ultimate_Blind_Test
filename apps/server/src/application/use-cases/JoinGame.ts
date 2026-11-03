import { err, GameCode, ok, PlayerName, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type { JoinGameCommand, JoinGameUseCase, PlayerSession } from '../ports/in';
import type { Clock, GameEventPublisher, GameRepository, IdGenerator } from '../ports/out';

export class JoinGame implements JoinGameUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: JoinGameCommand): Promise<Result<PlayerSession, UseCaseError>> {
    const code = GameCode.create(command.code);
    if (!code.ok) return code;
    const name = PlayerName.create(command.playerName);
    if (!name.ok) return name;

    const game = await this.games.findByCode(code.value);
    if (!game) return err(gameNotFound());

    const player = game.addPlayer({
      playerId: this.ids.next(),
      name: name.value,
      joinedAt: this.clock.now(),
    });
    if (!player.ok) return player;

    await this.games.save(game);
    this.events.playerJoined(game, player.value);
    return ok({ game, player: player.value });
  }
}
