import type {
  AckResponse,
  AnswerDto,
  AttachHostPayload,
  ClientToServerEvents,
  ErrorDto,
  GameSnapshotDto,
  JoinGamePayload,
  JudgeAnswerPayload,
  NextSongResponseDto,
  PlayerSessionDto,
  RejoinGamePayload,
  RevealDto,
  ScoreDto,
  SubmitAnswerPayload,
} from '@ubt/shared';

import type { GameSocket } from './socketClient';

export class GatewayError extends Error {
  readonly code: string;

  constructor(error: ErrorDto) {
    super(error.message);
    this.name = 'GatewayError';
    this.code = error.code;
  }
}

/**
 * Port used by the UI to send commands to the game server. Components and
 * hooks depend on this interface, never on socket.io directly.
 */
export interface GameGateway {
  attachHost(payload: AttachHostPayload): Promise<GameSnapshotDto>;
  nextSong(): Promise<NextSongResponseDto>;
  revealSong(): Promise<RevealDto>;
  judgeAnswer(payload: JudgeAnswerPayload): Promise<AnswerDto>;
  finishGame(): Promise<readonly ScoreDto[]>;
  joinGame(payload: JoinGamePayload): Promise<PlayerSessionDto>;
  rejoinGame(payload: RejoinGamePayload): Promise<PlayerSessionDto>;
  submitAnswer(payload: SubmitAnswerPayload): Promise<AnswerDto>;
}

/** song:next may wait for Deezer, hence more than the usual few seconds. */
const REQUEST_TIMEOUT_MS = 10_000;

export const createSocketGameGateway = (socket: GameSocket): GameGateway => {
  /**
   * Emits with a timeout and unwraps the ack. socket.io loses the ack typing
   * once `timeout()` is applied, so the expected type is restated here.
   */
  const request = async <T>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<T> => {
    const emitter = socket.timeout(REQUEST_TIMEOUT_MS) as unknown as {
      emitWithAck(event: string, ...args: unknown[]): Promise<AckResponse<T>>;
    };
    const response = await emitter.emitWithAck(event, ...args);
    if (!response.ok) throw new GatewayError(response.error);
    return response.data;
  };

  return {
    attachHost: (payload) => request<GameSnapshotDto>('host:attach', payload),
    nextSong: () => request<NextSongResponseDto>('song:next'),
    revealSong: () => request<RevealDto>('song:reveal'),
    judgeAnswer: (payload) => request<AnswerDto>('answer:judge', payload),
    finishGame: () => request<readonly ScoreDto[]>('game:finish'),
    joinGame: (payload) => request<PlayerSessionDto>('player:join', payload),
    rejoinGame: (payload) => request<PlayerSessionDto>('player:rejoin', payload),
    submitAnswer: (payload) => request<AnswerDto>('answer:submit', payload),
  };
};
