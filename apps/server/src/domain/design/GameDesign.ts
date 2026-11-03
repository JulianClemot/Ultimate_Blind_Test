import { gameError, type GameError } from '../game/GameErrors';
import { PlaylistId } from '../music/PlaylistId';
import { err, ok, type Result } from '../shared/Result';
import type { Timestamp } from '../shared/Timestamp';
import type { RoundPlan } from './RoundPlan';
import { RoundRules, type RoundRulesProps, type RoundType } from './RoundRules';

export interface CreateGameDesignProps {
  readonly id: string;
  readonly editToken: string;
  readonly name: string;
  readonly createdAt: Timestamp;
}

export interface UpdateGameDesignCommand {
  readonly name: string;
  readonly rounds: readonly RoundPlan[];
  readonly updatedAt: Timestamp;
}

/** Plain data form, used by repositories to store and restore a design. */
export interface GameDesignSnapshot {
  readonly id: string;
  readonly editToken: string;
  readonly name: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly rounds: readonly {
    /** Absent in designs saved before rounds had names. */
    readonly name?: string;
    readonly type: RoundType;
    readonly playlistId: string;
    readonly playlistTitle: string | null;
    readonly rules: RoundRulesProps;
  }[];
}

const normalizeName = (raw: string): Result<string, GameError> => {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length === 0 || name.length > GameDesign.MAX_NAME_LENGTH
    ? err(
        gameError(
          'INVALID_DESIGN_NAME',
          `Game name must contain 1 to ${GameDesign.MAX_NAME_LENGTH} characters`,
        ),
      )
    : ok(name);
};

/** A game prepared in advance by a host: an ordered list of rounds, launched later as a party. */
export class GameDesign {
  static readonly MAX_NAME_LENGTH = 60;
  static readonly MAX_ROUNDS = 20;

  private constructor(
    readonly id: string,
    private readonly editToken: string,
    private currentName: string,
    private currentRounds: readonly RoundPlan[],
    readonly createdAt: Timestamp,
    private lastUpdate: Timestamp,
  ) {}

  static create(props: CreateGameDesignProps): Result<GameDesign, GameError> {
    const name = normalizeName(props.name);
    if (!name.ok) return name;
    return ok(
      new GameDesign(props.id, props.editToken, name.value, [], props.createdAt, props.createdAt),
    );
  }

  /** Rebuilds a stored design. Throws on corrupted data: storage is trusted. */
  static restore(snapshot: GameDesignSnapshot): GameDesign {
    const rounds = snapshot.rounds.map((round): RoundPlan => {
      const playlist = PlaylistId.parse(round.playlistId);
      const rules = RoundRules.create(round.rules);
      if (!playlist.ok || !rules.ok) throw new Error(`Corrupted design ${snapshot.id}`);
      return {
        name: round.name ?? '',
        type: round.type,
        playlist: playlist.value,
        playlistTitle: round.playlistTitle,
        rules: rules.value,
      };
    });
    return new GameDesign(
      snapshot.id,
      snapshot.editToken,
      snapshot.name,
      rounds,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.currentName;
  }

  get rounds(): readonly RoundPlan[] {
    return this.currentRounds;
  }

  get updatedAt(): Timestamp {
    return this.lastUpdate;
  }

  canEdit(token: string): boolean {
    return token === this.editToken;
  }

  /** Replaces the name and the whole round list, as saved from the editor. */
  update(command: UpdateGameDesignCommand): Result<void, GameError> {
    const name = normalizeName(command.name);
    if (!name.ok) return name;
    if (command.rounds.length > GameDesign.MAX_ROUNDS) {
      return err(
        gameError('TOO_MANY_ROUNDS', `A game is limited to ${GameDesign.MAX_ROUNDS} rounds`),
      );
    }
    this.currentName = name.value;
    this.currentRounds = [...command.rounds];
    this.lastUpdate = command.updatedAt;
    return ok(undefined);
  }

  toSnapshot(): GameDesignSnapshot {
    return {
      id: this.id,
      editToken: this.editToken,
      name: this.currentName,
      createdAt: this.createdAt,
      updatedAt: this.lastUpdate,
      rounds: this.currentRounds.map((round) => ({
        name: round.name,
        type: round.type,
        playlistId: round.playlist.value,
        playlistTitle: round.playlistTitle,
        rules: round.rules.toProps(),
      })),
    };
  }
}
