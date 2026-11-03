import type { Answer, Game, Player, Song } from '../../../domain';

/** Notifies connected clients of what happened in a game. */
export interface GameEventPublisher {
  playerJoined(game: Game, player: Player): void;
  songStarted(game: Game, song: Song): void;
  answerReceived(game: Game, answer: Answer): void;
  /** The host corrected an answer: tell the host and the player who sent it. */
  answerJudged(game: Game, answer: Answer): void;
  songRevealed(game: Game, song: Song): void;
  /** Scores of revealed songs changed (correction after a reveal). */
  scoreboardUpdated(game: Game): void;
  gameFinished(game: Game): void;
}
