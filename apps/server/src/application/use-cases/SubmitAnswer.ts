import { err, ok, type Game, type Result } from '../../domain';
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

export class SubmitAnswer implements SubmitAnswerUseCase {
  /** Pause between "everyone answered" and the reveal. */
  static readonly REVEAL_DELAY_MS = 2000;

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
    this.revealOnceEveryoneAnswered(game);
    return ok({ game, answer: answer.value });
  }

  /** Announces that everyone answered, then reveals the song after a short pause. */
  private revealOnceEveryoneAnswered(game: Game): void {
    const song = game.currentSong;
    if (!song || !game.everyoneHasAnswered()) return;

    this.events.allAnswered(game, song);
    this.scheduler.after(SubmitAnswer.REVEAL_DELAY_MS, async () => {
      await this.autoReveal.execute({ gameId: game.id, songId: song.id });
    });
  }
}
