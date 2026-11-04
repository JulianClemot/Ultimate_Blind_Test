import type { RoundPlan } from '../design/RoundPlan';
import type { Verdict } from '../music/answerMatching';
import type { Track } from '../music/Track';
import { err, ok, type Result } from '../shared/Result';
import type { Timestamp } from '../shared/Timestamp';
import type { Answer } from './Answer';
import type { GameCode } from './GameCode';
import { gameError, type GameError } from './GameErrors';
import type { Player } from './Player';
import type { PlayerName } from './PlayerName';
import { buildRecap, type GameRecap } from './recap';
import { Round } from './Round';
import type { Song, SubmitAnswerCommand } from './Song';

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface CreateGameProps {
  readonly id: string;
  readonly code: GameCode;
  readonly hostToken: string;
  readonly createdAt: Timestamp;
  readonly name: string;
  /** Copied from the design: later edits of the design do not affect a running game. */
  readonly rounds: readonly RoundPlan[];
}

export interface AddPlayerCommand {
  readonly playerId: string;
  readonly name: PlayerName;
  readonly joinedAt: Timestamp;
}

export interface StartSongCommand {
  readonly songId: string;
  readonly startedAt: Timestamp;
  readonly track: Track;
}

export interface Score {
  readonly player: Player;
  readonly points: number;
}

/** Aggregate root of a party: every change to a running game goes through this class. */
export class Game {
  static readonly MAX_PLAYERS = 50;

  private readonly players = new Map<string, Player>();
  private readonly rounds: readonly Round[];
  private finished = false;

  private constructor(
    readonly id: string,
    readonly code: GameCode,
    private readonly hostToken: string,
    readonly createdAt: Timestamp,
    readonly name: string,
    plans: readonly RoundPlan[],
  ) {
    this.rounds = plans.map((plan, index) => new Round(index + 1, plan));
  }

  static create(props: CreateGameProps): Result<Game, GameError> {
    if (props.rounds.length === 0) {
      return err(gameError('EMPTY_DESIGN', 'Add at least one round before launching the game'));
    }
    return ok(
      new Game(props.id, props.code, props.hostToken, props.createdAt, props.name, props.rounds),
    );
  }

  get status(): GameStatus {
    if (this.finished) return 'finished';
    return this.currentSong ? 'playing' : 'lobby';
  }

  get currentRound(): Round | undefined {
    return this.rounds.findLast((round) => round.currentSong !== undefined);
  }

  get currentSong(): Song | undefined {
    return this.currentRound?.currentSong;
  }

  /** Round the next song will belong to; undefined once every round is complete. */
  get upcomingRound(): Round | undefined {
    if (this.finished) return undefined;
    const current = this.currentRound;
    if (!current) return this.rounds[0];
    return current.isComplete ? this.rounds[current.number] : current;
  }

  listRounds(): readonly Round[] {
    return this.rounds;
  }

  isHost(token: string): boolean {
    return token === this.hostToken;
  }

  listPlayers(): readonly Player[] {
    return [...this.players.values()];
  }

  findPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  hasPlayed(trackId: string): boolean {
    return this.rounds.some((round) => round.listSongs().some((song) => song.track.id === trackId));
  }

  addPlayer(command: AddPlayerCommand): Result<Player, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    if (this.players.size >= Game.MAX_PLAYERS) {
      return err(gameError('GAME_FULL', `A game is limited to ${Game.MAX_PLAYERS} players`));
    }
    if (this.listPlayers().some((p) => p.name.sameAs(command.name))) {
      return err(gameError('PLAYER_NAME_TAKEN', `"${command.name.value}" is already taken`));
    }
    const player: Player = { id: command.playerId, name: command.name, joinedAt: command.joinedAt };
    this.players.set(player.id, player);
    return ok(player);
  }

  /** Plays the next song of the upcoming round. The current song must be revealed first. */
  startSong(command: StartSongCommand): Result<Song, GameError> {
    const blocked = this.canMoveOn();
    if (!blocked.ok) return blocked;
    const round = this.upcomingRound;
    if (!round) return err(gameError('GAME_FINISHED', 'Every round has been played'));
    return ok(round.addSong(command.songId, command.startedAt, command.track));
  }

  /** Ends the party, after the current song was revealed. Can be done before the last round. */
  finish(): Result<void, GameError> {
    const blocked = this.canMoveOn();
    if (!blocked.ok) return blocked;
    this.finished = true;
    return ok(undefined);
  }

  submitAnswer(command: SubmitAnswerCommand): Result<Answer, GameError> {
    if (!this.players.has(command.playerId)) {
      return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    }
    const song = this.currentSong;
    if (!song || this.finished) {
      return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    }
    return song.submit(command);
  }

  revealSong(at: Timestamp): Result<Song, GameError> {
    const song = this.currentSong;
    if (!song) return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    return song.reveal(at);
  }

  judgeAnswer(answerId: string, verdict: Verdict): Result<Answer, GameError> {
    const song = this.currentSong;
    if (!song) return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    return song.judge(answerId, verdict);
  }

  /**
   * Total points per player, best first. Players see `revealedOnly` scores so a running
   * song does not leak who already found it.
   */
  scoreboard({ revealedOnly }: { revealedOnly: boolean }): readonly Score[] {
    const totals = new Map<string, number>([...this.players.keys()].map((id) => [id, 0]));
    for (const round of this.rounds) {
      for (const song of round.listSongs()) {
        if (revealedOnly && !song.isRevealed) continue;
        for (const [playerId, points] of song.points()) {
          if (totals.has(playerId)) totals.set(playerId, (totals.get(playerId) ?? 0) + points);
        }
      }
    }
    return this.listPlayers()
      .map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
      .sort(
        (a, b) => b.points - a.points || a.player.name.value.localeCompare(b.player.name.value),
      );
  }

  /** End-of-game recap; only available once the game is finished. */
  recap(): GameRecap | undefined {
    return this.finished ? buildRecap(this.listPlayers(), this.rounds) : undefined;
  }

  /** Whether the game may leave the current song (to play another one or to finish). */
  canMoveOn(): Result<void, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    if (this.currentSong && !this.currentSong.isRevealed) {
      return err(gameError('SONG_IN_PROGRESS', 'Reveal the current song first'));
    }
    return ok(undefined);
  }
}
