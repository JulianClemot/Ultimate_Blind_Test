import {
  attachHostPayloadSchema,
  generateTeamsPayloadSchema,
  judgeAnswerPayloadSchema,
  type NextSongResponseDto,
} from '@ubt/shared';
import type { FastifyBaseLogger } from 'fastify';

import type {
  AttachHostUseCase,
  FinishGameUseCase,
  GenerateTeamsUseCase,
  JudgeAnswerUseCase,
  NextSongResult,
  NextSongUseCase,
  RevealSongUseCase,
} from '../../../application';
import {
  toAnswerDto,
  toGameSnapshotDto,
  toHostSongDto,
  toPublicScoreboard,
  toRevealDto,
  toTeamDtos,
} from '../../mappers/dtoMappers';
import { rooms } from '../../realtime/rooms';
import type { GameSocket } from '../../realtime/types';
import { fromResult, notIdentified, parsePayload, respond } from './respond';

export interface HostUseCases {
  readonly attachHost: AttachHostUseCase;
  readonly generateTeams: GenerateTeamsUseCase;
  readonly nextSong: NextSongUseCase;
  readonly revealSong: RevealSongUseCase;
  readonly judgeAnswer: JudgeAnswerUseCase;
  readonly finishGame: FinishGameUseCase;
}

const toNextSongResponseDto = (result: NextSongResult): NextSongResponseDto =>
  result.kind === 'song'
    ? { kind: 'song', song: toHostSongDto(result.game, result.song) }
    : { kind: 'finished', scoreboard: toPublicScoreboard(result.game) };

export const registerHostHandlers = (
  socket: GameSocket,
  useCases: HostUseCases,
  logger: FastifyBaseLogger,
): void => {
  /** The host session stored on the socket by host:attach, if any. */
  const hostSession = () => {
    const session = socket.data.session;
    return session?.role === 'host' ? session : undefined;
  };

  socket.on('host:attach', (payload, ack) =>
    respond(ack, logger, async () => {
      const input = parsePayload(attachHostPayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.attachHost.execute(input.value);
      if (result.ok) {
        const gameId = result.value.id;
        socket.data.session = { role: 'host', gameId, hostToken: input.value.hostToken };
        await socket.join([rooms.game(gameId), rooms.hosts(gameId)]);
      }
      return fromResult(result, toGameSnapshotDto);
    }),
  );

  socket.on('teams:generate', (payload, ack) =>
    respond(ack, logger, async () => {
      const session = hostSession();
      if (!session) return notIdentified();
      const input = parsePayload(generateTeamsPayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.generateTeams.execute({ ...session, ...input.value });
      return fromResult(result, toTeamDtos);
    }),
  );

  socket.on('song:next', (ack) =>
    respond(ack, logger, async () => {
      const session = hostSession();
      if (!session) return notIdentified();
      return fromResult(await useCases.nextSong.execute(session), toNextSongResponseDto);
    }),
  );

  socket.on('song:reveal', (ack) =>
    respond(ack, logger, async () => {
      const session = hostSession();
      if (!session) return notIdentified();
      const result = await useCases.revealSong.execute(session);
      return fromResult(result, ({ game, song }) => toRevealDto(game, song));
    }),
  );

  socket.on('answer:judge', (payload, ack) =>
    respond(ack, logger, async () => {
      const session = hostSession();
      if (!session) return notIdentified();
      const input = parsePayload(judgeAnswerPayloadSchema, payload);
      if (!input.ok) return input.response;

      const result = await useCases.judgeAnswer.execute({ ...session, ...input.value });
      return fromResult(result, ({ game, answer }) => toAnswerDto(game, answer));
    }),
  );

  socket.on('game:finish', (ack) =>
    respond(ack, logger, async () => {
      const session = hostSession();
      if (!session) return notIdentified();
      return fromResult(await useCases.finishGame.execute(session), toPublicScoreboard);
    }),
  );
};
