import type { GameEventPublisher } from '../../src/application';
import type { Answer, Game, Player, Song } from '../../src/domain';

type RecordedEvent =
  | { type: 'playerJoined'; gameId: string; player: Player }
  | { type: 'songStarted'; gameId: string; song: Song }
  | { type: 'answerReceived'; gameId: string; answer: Answer }
  | { type: 'answerJudged'; gameId: string; answer: Answer }
  | { type: 'allAnswered'; gameId: string; song: Song }
  | { type: 'songRevealed'; gameId: string; song: Song }
  | { type: 'scoreboardUpdated'; gameId: string }
  | { type: 'gameFinished'; gameId: string };

export class RecordingEventPublisher implements GameEventPublisher {
  readonly events: RecordedEvent[] = [];

  types(): RecordedEvent['type'][] {
    return this.events.map((e) => e.type);
  }

  playerJoined(game: Game, player: Player): void {
    this.events.push({ type: 'playerJoined', gameId: game.id, player });
  }

  songStarted(game: Game, song: Song): void {
    this.events.push({ type: 'songStarted', gameId: game.id, song });
  }

  answerReceived(game: Game, answer: Answer): void {
    this.events.push({ type: 'answerReceived', gameId: game.id, answer });
  }

  answerJudged(game: Game, answer: Answer): void {
    this.events.push({ type: 'answerJudged', gameId: game.id, answer });
  }

  allAnswered(game: Game, song: Song): void {
    this.events.push({ type: 'allAnswered', gameId: game.id, song });
  }

  songRevealed(game: Game, song: Song): void {
    this.events.push({ type: 'songRevealed', gameId: game.id, song });
  }

  scoreboardUpdated(game: Game): void {
    this.events.push({ type: 'scoreboardUpdated', gameId: game.id });
  }

  gameFinished(game: Game): void {
    this.events.push({ type: 'gameFinished', gameId: game.id });
  }
}
