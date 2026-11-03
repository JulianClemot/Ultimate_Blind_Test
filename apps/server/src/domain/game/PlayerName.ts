import { err, ok, type Result } from '../shared/Result';
import { gameError, type GameError } from './GameErrors';

export class PlayerName {
  static readonly MAX_LENGTH = 20;

  private constructor(readonly value: string) {}

  static create(raw: string): Result<PlayerName, GameError> {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length === 0 || value.length > PlayerName.MAX_LENGTH) {
      return err(
        gameError(
          'INVALID_PLAYER_NAME',
          `Player name must contain 1 to ${PlayerName.MAX_LENGTH} characters`,
        ),
      );
    }
    return ok(new PlayerName(value));
  }

  /** Names are unique per game, case-insensitively. */
  sameAs(other: PlayerName): boolean {
    return this.value.localeCompare(other.value, undefined, { sensitivity: 'accent' }) === 0;
  }
}
