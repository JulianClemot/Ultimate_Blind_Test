/** Wire representations. They never leak domain classes to clients. */

// ── Game designs ────────────────────────────────────────────────────────────

export type RoundTypeDto = 'classic' | 'everyone' | 'flash' | 'fast-forward';
export type ScoringDto = 'first' | 'everyone';

export interface RoundRulesDto {
  readonly scoring: ScoringDto;
  /** With `first` scoring: how many players, the first to answer correctly, get the points. */
  readonly winnerCount: number;
  /** With `first` scoring: points lost by each place (the 2nd gets this many less than the 1st…). */
  readonly rankStep: number;
  readonly songCount: number;
  readonly titlePoints: number;
  readonly artistPoints: number;
  readonly bothBonus: number;
  readonly speedBonus: number;
  readonly answerTimeSec: number;
  readonly excerptSec: number;
  readonly playbackRate: number;
}

export type NumericRuleDto = Exclude<keyof RoundRulesDto, 'scoring' | 'playbackRate'>;

/** Presets and limits served by the server, so the editor never duplicates the rules. */
export interface RoundCatalogDto {
  readonly presets: Readonly<Record<RoundTypeDto, RoundRulesDto>>;
  readonly limits: Readonly<Record<NumericRuleDto, { readonly min: number; readonly max: number }>>;
  readonly playbackRates: readonly number[];
  readonly maxRounds: number;
}

export interface RoundPlanDto {
  /** Empty when the host gave none. */
  readonly name: string;
  readonly type: RoundTypeDto;
  /** Deezer playlist id. */
  readonly playlist: string;
  readonly playlistTitle: string | null;
  readonly rules: RoundRulesDto;
}

export interface GameDesignDto {
  readonly id: string;
  readonly name: string;
  readonly rounds: readonly RoundPlanDto[];
  readonly updatedAt: number;
}

export interface CreateGameDesignResponseDto {
  readonly design: GameDesignDto;
  /** Secret allowing to edit and launch the design. Only returned at creation. */
  readonly editToken: string;
}

export interface PlaylistSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly playableTracks: number;
}

// ── Parties ─────────────────────────────────────────────────────────────────

export type GameStatusDto = 'lobby' | 'playing' | 'finished';

export interface PlayerDto {
  readonly id: string;
  readonly name: string;
}

export interface ScoreDto {
  readonly playerId: string;
  readonly playerName: string;
  readonly points: number;
}

/**
 * A round as announced to everyone: its name, type and rules. The playlist is left out on
 * purpose: its id or title could give the songs away.
 */
export interface RoundSummaryDto {
  readonly number: number;
  readonly name: string;
  readonly type: RoundTypeDto;
  readonly songCount: number;
  readonly rules: RoundRulesDto;
}

export interface SongDto {
  readonly id: string;
  readonly roundNumber: number;
  /** Empty when the host gave none: show the round type instead. */
  readonly roundName: string;
  readonly roundType: RoundTypeDto;
  /** Position within the round, from 1. */
  readonly number: number;
  readonly songCount: number;
  /** Server epoch ms (sub-millisecond precision). */
  readonly startedAt: number;
  readonly answerTimeSec: number;
  readonly asksTitle: boolean;
  readonly asksArtist: boolean;
  readonly revealed: boolean;
}

/**
 * What the host screen gets: the song plus the audio to play. Title and artist
 * are only sent at the reveal, so nobody (host included) knows the answer before.
 */
export interface HostSongDto extends SongDto {
  /** 30 s Deezer preview. Signed URL that expires after a few minutes. */
  readonly previewUrl: string;
  readonly excerptSec: number;
  readonly playbackRate: number;
}

export interface RevealDto {
  readonly songId: string;
  readonly title: string;
  readonly artist: string;
  /** Scores of revealed songs only. */
  readonly scoreboard: readonly ScoreDto[];
}

export interface VerdictDto {
  readonly title: boolean;
  readonly artist: boolean;
}

export interface AnswerDto {
  readonly id: string;
  readonly songId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly text: string;
  /** Server epoch ms at reception — the authoritative timestamp. */
  readonly receivedAt: number;
  /** receivedAt − song.startedAt. */
  readonly elapsedMs: number;
  readonly clientSentAt: number;
  readonly verdict: VerdictDto;
  readonly judgedByHost: boolean;
}

// ── End-of-game recap ───────────────────────────────────────────────────────

export type SuperlativeKindDto = 'fastest-finger' | 'sniper' | 'stubborn' | 'comeback-kid';

export interface StandingDto {
  /** Ties share a rank (1, 2, 2, 4). */
  readonly rank: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly points: number;
}

export interface SuperlativeDto {
  readonly kind: SuperlativeKindDto;
  readonly playerId: string;
  readonly playerName: string;
  /** Average find time (ms), songs found first, wrong attempts, or places gained, by kind. */
  readonly value: number;
}

/** What a player did on a song. Never the text of their answers. */
export interface PlayerSongResultDto {
  readonly playerId: string;
  readonly playerName: string;
  readonly points: number;
  readonly foundTitle: boolean;
  readonly foundArtist: boolean;
  /** ms after the song started, null when never found. */
  readonly foundAtMs: number | null;
  readonly wrongAttempts: number;
}

export interface SongRecapDto {
  readonly songId: string;
  readonly roundNumber: number;
  readonly roundName: string;
  readonly number: number;
  readonly title: string;
  readonly artist: string;
  /** Who found the song first, then the others. */
  readonly results: readonly PlayerSongResultDto[];
}

/** Sent once the game is finished, when every song is revealed. */
export interface GameRecapDto {
  readonly gameName: string;
  readonly standings: readonly StandingDto[];
  readonly superlatives: readonly SuperlativeDto[];
  readonly songs: readonly SongRecapDto[];
}

export interface GameSnapshotDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: GameStatusDto;
  readonly players: readonly PlayerDto[];
  readonly rounds: readonly RoundSummaryDto[];
  readonly currentSong: HostSongDto | null;
  /** Set once the current song is revealed. */
  readonly reveal: RevealDto | null;
  /** Answers of the current song, fastest first. */
  readonly answers: readonly AnswerDto[];
  /** Scores of revealed songs, like the players see them. */
  readonly scoreboard: readonly ScoreDto[];
  /** False when the next action finishes the game. */
  readonly hasNextSong: boolean;
  /** Null until the game is finished. */
  readonly recap: GameRecapDto | null;
}

export interface CreateGameResponseDto {
  readonly gameId: string;
  readonly code: string;
  readonly hostToken: string;
}

/** What a player is allowed to see: never the other players' answers. */
export interface PlayerSessionDto {
  readonly gameId: string;
  readonly code: string;
  readonly name: string;
  readonly status: GameStatusDto;
  readonly player: PlayerDto;
  /** Every round of the game with its rules, to show in the lobby. */
  readonly rounds: readonly RoundSummaryDto[];
  readonly currentSong: SongDto | null;
  readonly reveal: RevealDto | null;
  /** The player's own answers to the current song. */
  readonly myAnswers: readonly AnswerDto[];
  /** Scores of revealed songs only. */
  readonly scoreboard: readonly ScoreDto[];
  /** Null until the game is finished. */
  readonly recap: GameRecapDto | null;
}

export type NextSongResponseDto =
  | { readonly kind: 'song'; readonly song: HostSongDto }
  | { readonly kind: 'finished'; readonly scoreboard: readonly ScoreDto[] };

export interface ErrorDto {
  readonly code: string;
  readonly message: string;
}
