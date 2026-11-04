import type {
  AllAnsweredDto,
  AnswerDto,
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
} from './dtos';
import type {
  AttachHostPayload,
  JoinGamePayload,
  JudgeAnswerPayload,
  RejoinGamePayload,
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
  'game:finish': (ack: Ack<readonly ScoreDto[]>) => void;
  'player:join': (payload: JoinGamePayload, ack: Ack<PlayerSessionDto>) => void;
  'player:rejoin': (payload: RejoinGamePayload, ack: Ack<PlayerSessionDto>) => void;
  'answer:submit': (payload: SubmitAnswerPayload, ack: Ack<AnswerDto>) => void;
}

/** Events pushed by the server. */
export interface ServerToClientEvents {
  /** To hosts. */
  'player:joined': (player: PlayerDto) => void;
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
  /** To everyone: final scores. */
  'game:finished': (scoreboard: readonly ScoreDto[]) => void;
  /** To everyone, right after `game:finished` (and again if the host corrects an answer later). */
  'game:recap': (recap: GameRecapDto) => void;
}
