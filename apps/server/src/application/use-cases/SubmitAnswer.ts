import { err, ok, type Result } from '../../domain';
import { gameNotFound, type UseCaseError } from '../errors';
import type {
  AutoRevealSongUseCase,
  GameAnswer,
  SubmitAnswerCommand,
  SubmitAnswerUseCase,
} from '../ports/in';
import type {
  Clock,
  GameEventPublisher,
  GameRepository,
  IdGenerator,
  Scheduler,
} from '../ports/out';
import { REVEAL_DELAY_MS, revealOnceEveryoneAnswered } from './revealOnceEveryoneAnswered';

export class SubmitAnswer implements SubmitAnswerUseCase {
  /** Pause between "everyone answered" and the reveal. */
  static readonly REVEAL_DELAY_MS = REVEAL_DELAY_MS;

  constructor(
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
    private readonly scheduler: Scheduler,
    private readonly autoReveal: AutoRevealSongUseCase,
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
      suggestionId: command.suggestionId,
    });
    if (!answer.ok) return answer;

    await this.games.save(game);
    this.events.answerReceived(game, answer.value);
    revealOnceEveryoneAnswered(game, this.events, this.scheduler, this.autoReveal);
    return ok({ game, answer: answer.value });
  }
}
