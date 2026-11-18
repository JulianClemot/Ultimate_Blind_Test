import type { Game } from '../../domain';
import type { AutoRevealSongUseCase } from '../ports/in';
import type { GameEventPublisher, Scheduler } from '../ports/out';

/** Pause between "everyone answered" and the reveal. */
export const REVEAL_DELAY_MS = 2000;

/** Announces that everyone answered, then reveals the song after a short pause. */
export const revealOnceEveryoneAnswered = (
  game: Game,
  events: GameEventPublisher,
  scheduler: Scheduler,
  autoReveal: AutoRevealSongUseCase,
): void => {
  const song = game.currentSong;
  if (!song || !game.everyoneHasAnswered()) return;

  events.allAnswered(game, song);
  scheduler.after(REVEAL_DELAY_MS, async () => {
    await autoReveal.execute({ gameId: game.id, songId: song.id });
  });
};
