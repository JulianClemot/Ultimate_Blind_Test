import type {
  Answer,
  Game,
  GameDesign,
  Player,
  Result,
  RoundRulesProps,
  RoundType,
  Song,
} from '../../../domain';
import type { UseCaseError } from '../../errors';
import type { Playlist } from '../out/MusicCatalog';

/** Driving ports: what primary adapters (HTTP, sockets…) are allowed to ask the core. */

interface UseCase<C, R> {
  execute(command: C): Promise<Result<R, UseCaseError>>;
}

// ── Game designs ────────────────────────────────────────────────────────────

export interface DesignAccess {
  readonly designId: string;
  readonly editToken: string;
}

export interface CreateGameDesignCommand {
  readonly name: string;
}
export interface CreatedGameDesign {
  readonly design: GameDesign;
  readonly editToken: string;
}
export type CreateGameDesignUseCase = UseCase<CreateGameDesignCommand, CreatedGameDesign>;

export type GetGameDesignUseCase = UseCase<DesignAccess, GameDesign>;

export interface RoundPlanInput {
  readonly name: string;
  readonly type: RoundType;
  /** Deezer playlist id or URL. */
  readonly playlist: string;
  readonly playlistTitle: string | null;
  readonly rules: RoundRulesProps;
}
export interface UpdateGameDesignCommand extends DesignAccess {
  readonly name: string;
  readonly rounds: readonly RoundPlanInput[];
}
export type UpdateGameDesignUseCase = UseCase<UpdateGameDesignCommand, GameDesign>;

export type DeleteGameDesignUseCase = UseCase<DesignAccess, void>;

export interface CheckPlaylistCommand {
  readonly playlist: string;
}
export type CheckPlaylistUseCase = UseCase<CheckPlaylistCommand, Playlist>;

// ── Parties ─────────────────────────────────────────────────────────────────

export interface LaunchedGame {
  readonly game: Game;
  readonly hostToken: string;
}
export type LaunchGameUseCase = UseCase<DesignAccess, LaunchedGame>;

export interface HostCommand {
  readonly gameId: string;
  readonly hostToken: string;
}
export type AttachHostUseCase = UseCase<HostCommand, Game>;

export interface PlayerSession {
  readonly game: Game;
  readonly player: Player;
}

export interface JoinGameCommand {
  readonly code: string;
  readonly playerName: string;
}
export type JoinGameUseCase = UseCase<JoinGameCommand, PlayerSession>;

export interface RejoinGameCommand {
  readonly gameId: string;
  readonly playerId: string;
}
export type RejoinGameUseCase = UseCase<RejoinGameCommand, PlayerSession>;

/** Either a new song started, or every round was played and the game is now finished. */
export type NextSongResult =
  | { readonly kind: 'song'; readonly game: Game; readonly song: Song }
  | { readonly kind: 'finished'; readonly game: Game };
export type NextSongUseCase = UseCase<HostCommand, NextSongResult>;

export interface RevealedSong {
  readonly game: Game;
  readonly song: Song;
}
export type RevealSongUseCase = UseCase<HostCommand, RevealedSong>;

export type FinishGameUseCase = UseCase<HostCommand, Game>;

export interface JudgeAnswerCommand extends HostCommand {
  readonly answerId: string;
  readonly title: boolean;
  readonly artist: boolean;
}
export interface GameAnswer {
  readonly game: Game;
  readonly answer: Answer;
}
export type JudgeAnswerUseCase = UseCase<JudgeAnswerCommand, GameAnswer>;

export interface SubmitAnswerCommand {
  readonly gameId: string;
  readonly playerId: string;
  readonly text: string;
  readonly clientSentAt: number;
}
export type SubmitAnswerUseCase = UseCase<SubmitAnswerCommand, GameAnswer>;
