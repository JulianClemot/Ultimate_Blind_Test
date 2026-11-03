import { err, ok, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type { GameAnswer, SubmitAnswerCommand, SubmitAnswerUseCase } from '../ports/in';
import type { Clock, GameEventPublisher, GameRepository, IdGenerator } from '../ports/out';

export class SubmitAnswer implements SubmitAnswerUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: SubmitAnswerCommand): Promise<Result<GameAnswer, UseCaseError>> {
    // Timestamp first: the reception time must not include persistence latency.
    const receivedAt = this.clock.now();

    const game = await this.games.findById(command.gameId);
    if (!game) return err(gameNotFound());

    const answer = game.submitAnswer({
      answerId: this.ids.next(),
      playerId: command.playerId,
      text: command.text,
      receivedAt,
      clientSentAt: command.clientSentAt,
    });
    if (!answer.ok) return answer;

    await this.games.save(game);
    this.events.answerReceived(game, answer.value);
    return ok({ game, answer: answer.value });
  }
}
