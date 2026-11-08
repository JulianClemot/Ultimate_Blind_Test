import type { RoundRules } from '../design/RoundRules';
import { matchAnswer, matchPick, type Verdict } from '../music/answerMatching';
import type { Suggestion, Track } from '../music/Track';
import { err, ok, type Result } from '../shared/Result';
import type { Timestamp } from '../shared/Timestamp';
import type { Answer } from './Answer';
import { gameError, type GameError } from './GameErrors';
import { scoreSong } from './scoring';

export interface SubmitAnswerCommand {
  readonly answerId: string;
  readonly playerId: string;
  readonly text: string;
  readonly receivedAt: Timestamp;
  readonly clientSentAt: Timestamp;
  /** Set when the text was picked from the suggestions of an easy round: judged exactly. */
  readonly picked?: Suggestion;
}

/** One track played within a round. Each player has a single guess. */
export class Song {
  static readonly MAX_ANSWER_LENGTH = 200;

  private readonly answers: Answer[] = [];
  private revealTime: Timestamp | undefined;

  constructor(
    readonly id: string,
    readonly roundNumber: number,
    /** Position within its round, from 1. */
    readonly number: number,
    readonly startedAt: Timestamp,
    readonly track: Track,
    readonly rules: RoundRules,
  ) {}

  get closesAt(): Timestamp {
    return this.startedAt + this.rules.answerTimeMs;
  }

  get isRevealed(): boolean {
    return this.revealTime !== undefined;
  }

  get revealedAt(): Timestamp | undefined {
    return this.revealTime;
  }

  submit(command: SubmitAnswerCommand): Result<Answer, GameError> {
    if (this.isRevealed || command.receivedAt > this.closesAt) {
      return err(gameError('SONG_CLOSED', 'Time is up for this song'));
    }
    const text = command.text.trim();
    if (text.length === 0 || text.length > Song.MAX_ANSWER_LENGTH) {
      return err(
        gameError(
          'INVALID_ANSWER',
          `Answer must contain 1 to ${Song.MAX_ANSWER_LENGTH} characters`,
        ),
      );
    }
    if (this.hasAnswered(command.playerId)) {
      return err(gameError('ALREADY_ANSWERED', 'You already answered this song'));
    }
    const answer: Answer = {
      id: command.answerId,
      songId: this.id,
      playerId: command.playerId,
      text,
      receivedAt: command.receivedAt,
      elapsedMs: Math.max(0, command.receivedAt - this.startedAt),
      clientSentAt: command.clientSentAt,
      verdict: command.picked
        ? matchPick(command.picked, this.track)
        : matchAnswer(text, this.track),
      judgedByHost: false,
      assisted: command.picked !== undefined,
    };
    this.answers.push(answer);
    return ok(answer);
  }

  /** Host correction of the automatic verdict; allowed until the next song starts. */
  judge(answerId: string, verdict: Verdict): Result<Answer, GameError> {
    const index = this.answers.findIndex((a) => a.id === answerId);
    const answer = this.answers[index];
    if (!answer) return err(gameError('UNKNOWN_ANSWER', 'No such answer for the current song'));
    const judged: Answer = { ...answer, verdict, judgedByHost: true };
    this.answers[index] = judged;
    return ok(judged);
  }

  reveal(at: Timestamp): Result<Song, GameError> {
    if (this.isRevealed) return err(gameError('SONG_ALREADY_REVEALED', 'Song already revealed'));
    this.revealTime = at;
    return ok(this);
  }

  /** Answers ranked by server reception time, fastest first. */
  answersByArrival(): readonly Answer[] {
    return [...this.answers].sort((a, b) => a.receivedAt - b.receivedAt);
  }

  answersOf(playerId: string): readonly Answer[] {
    return this.answersByArrival().filter((a) => a.playerId === playerId);
  }

  points(): ReadonlyMap<string, number> {
    return scoreSong(this.rules, this.answers);
  }

  hasAnswered(playerId: string): boolean {
    return this.answers.some((a) => a.playerId === playerId);
  }
}
