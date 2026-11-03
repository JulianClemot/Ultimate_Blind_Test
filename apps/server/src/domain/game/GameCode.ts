import { err, ok, type Result } from '../shared/Result';
import { gameError, type GameError } from './GameErrors';

/** Short human-friendly code players type to join a game (e.g. "KQ7RTX"). */
export class GameCode {
  /** Ambiguous characters (0/O, 1/I/L) are excluded to ease typing on phones. */
  static readonly ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  static readonly LENGTH = 6;

  private static readonly PATTERN = new RegExp(`^[${GameCode.ALPHABET}]{${GameCode.LENGTH}}$`);

  private constructor(readonly value: string) {}

  static create(raw: string): Result<GameCode, GameError> {
    const value = raw.trim().toUpperCase();
    return GameCode.PATTERN.test(value)
      ? ok(new GameCode(value))
      : err(gameError('INVALID_GAME_CODE', `"${raw}" is not a valid game code`));
  }

  equals(other: GameCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
