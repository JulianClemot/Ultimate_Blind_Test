import { ok, type Result } from '../../domain';
import type { UseCaseError } from '../errors';
import type { GameAnswer, JudgeAnswerCommand, JudgeAnswerUseCase } from '../ports/in';
import type { GameEventPublisher, GameRepository } from '../ports/out';
import { loadHostedGame } from './access';

/** The host overrules the automatic verdict of an answer of the current song. */
export class JudgeAnswer implements JudgeAnswerUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEventPublisher,
  ) {}

  async execute(command: JudgeAnswerCommand): Promise<Result<GameAnswer, UseCaseError>> {
    const game = await loadHostedGame(this.games, command);
    if (!game.ok) return game;

    const answer = game.value.judgeAnswer(command.answerId, {
      title: command.title,
      artist: command.artist,
    });
    if (!answer.ok) return answer;
    await this.games.save(game.value);
    this.events.answerJudged(game.value, answer.value);
    if (game.value.currentSong?.isRevealed) this.events.scoreboardUpdated(game.value);
    return ok({ game: game.value, answer: answer.value });
  }
}
