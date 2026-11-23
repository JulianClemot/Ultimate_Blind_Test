import type {
  AllAnsweredDto,
  AnswerDto,
  EliminationDto,
  ErrorDto,
  GameRecapDto,
  GameSnapshotDto,
  HostSongDto,
  NextSongResponseDto,
  PlayerDto,
  PlayerSessionDto,
  RevealDto,
  ScoreDto,
  SongDto,
  TeamDto,
  TeamScoreDto,
} from './dtos';
import type {
  AttachHostPayload,
  GenerateTeamsPayload,
  JoinGamePayload,
  JudgeAnswerPayload,
  KickPlayerPayload,
  MovePlayersPayload,
  RejoinGamePayload,
  RenameTeamPayload,
  SubmitAnswerPayload,
} from './schemas';

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: ErrorDto };
export type Ack<T> = (response: AckResponse<T>) => void;

/** Events emitted by clients (host or players) and handled by the server. */
export interface ClientToServerEvents {
  'host:attach': (payload: AttachHostPayload, ack: Ack<GameSnapshotDto>) => void;
  /** Plays the next song, or finishes the game after the last one. */
  'song:next': (ack: Ack<NextSongResponseDto>) => void;
  'song:reveal': (ack: Ack<RevealDto>) => void;
  'answer:judge': (payload: JudgeAnswerPayload, ack: Ack<AnswerDto>) => void;
  /** Lobby only: (re)shuffles every player into balanced, freshly named teams. */
  'teams:generate': (payload: GenerateTeamsPayload, ack: Ack<readonly TeamDto[]>) => void;
  /** Lobby only: replaces a team's name. */
  'teams:rename': (payload: RenameTeamPayload, ack: Ack<readonly TeamDto[]>) => void;
  /** Lobby only: puts players in another team, all or none (a team is never left empty). */
  'teams:move-players': (payload: MovePlayersPayload, ack: Ack<readonly TeamDto[]>) => void;
  /** Removes a player, at any time before the end; their name cannot be reused in this game. */
  'player:kick': (payload: KickPlayerPayload, ack: Ack<PlayerDto>) => void;
  'game:finish': (ack: Ack<readonly ScoreDto[]>) => void;
  /** Ends the game right now for everyone, even before the current song is revealed. */
  'game:close': (ack: Ack<readonly ScoreDto[]>) => void;
  'player:join': (payload: JoinGamePayload, ack: Ack<PlayerSessionDto>) => void;
  'player:rejoin': (payload: RejoinGamePayload, ack: Ack<PlayerSessionDto>) => void;
  'answer:submit': (payload: SubmitAnswerPayload, ack: Ack<AnswerDto>) => void;
}

/** Events pushed by the server. */
export interface ServerToClientEvents {
  /** To hosts. */
  'player:joined': (player: PlayerDto) => void;
  /** To everyone in the game, the kicked player included (who is then shut out of the game). */
  'player:kicked': (payload: { playerId: string }) => void;
  /** To players only (no audio, so they cannot look the song up). */
  'song:started': (song: SongDto) => void;
  /** To hosts only: the song with the preview to play. */
  'host:song-started': (song: HostSongDto) => void;
  /** To hosts. */
  'answer:received': (answer: AnswerDto) => void;
  /** To hosts and to the player who sent the answer. */
  'answer:judged': (answer: AnswerDto) => void;
  /** To everyone: all players answered, the server reveals the song in a couple of seconds. */
  'song:all-answered': (payload: AllAnsweredDto) => void;
  /** To everyone. */
  'song:revealed': (reveal: RevealDto) => void;
  /** To everyone: scores of revealed songs changed after a correction. */
  'scoreboard:updated': (scoreboard: readonly ScoreDto[]) => void;
  /** To everyone, with `scoreboard:updated`, during a last-standing round: who is out changed. */
  'elimination:updated': (elimination: EliminationDto) => void;
  /** To everyone: teams were generated, renamed or rearranged, or a latecomer joined one. */
  'teams:updated': (teams: readonly TeamDto[]) => void;
  /** To everyone, with `scoreboard:updated`: team points changed after a correction. */
  'team-scores:updated': (scores: readonly TeamScoreDto[]) => void;
  /** To everyone: final scores. */
  'game:finished': (scoreboard: readonly ScoreDto[]) => void;
  /** To everyone, right after `game:finished` (and again if the host corrects an answer later). */
  'game:recap': (recap: GameRecapDto) => void;
}
