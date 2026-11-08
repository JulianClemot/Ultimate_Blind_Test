import {
  analyzePlaylistQuerySchema,
  checkPlaylistQuerySchema,
  createGameDesignPayloadSchema,
  updateGameDesignPayloadSchema,
  type CreateGameDesignResponseDto,
  type RoundCatalogDto,
} from '@ubt/shared';
import type { FastifyInstance } from 'fastify';

import type {
  AnalyzePlaylistUseCase,
  CheckPlaylistUseCase,
  CreateGameDesignUseCase,
  DeleteGameDesignUseCase,
  GetGameDesignUseCase,
  UpdateGameDesignUseCase,
} from '../../../application';
import { GameDesign, PLAYBACK_RATES, ROUND_PRESETS, RULE_LIMITS } from '../../../domain';
import {
  toGameDesignDto,
  toPlaylistAnalysisDto,
  toPlaylistSummaryDto,
} from '../../mappers/dtoMappers';
import { bearerToken, parseOr400, sendResult } from './httpHelpers';

export interface DesignRoutesUseCases {
  readonly createGameDesign: CreateGameDesignUseCase;
  readonly getGameDesign: GetGameDesignUseCase;
  readonly updateGameDesign: UpdateGameDesignUseCase;
  readonly deleteGameDesign: DeleteGameDesignUseCase;
  readonly checkPlaylist: CheckPlaylistUseCase;
  readonly analyzePlaylist: AnalyzePlaylistUseCase;
}

interface DesignParams {
  Params: { designId: string };
}

const roundCatalog: RoundCatalogDto = {
  presets: ROUND_PRESETS,
  limits: RULE_LIMITS,
  playbackRates: PLAYBACK_RATES,
  maxRounds: GameDesign.MAX_ROUNDS,
};

export const registerDesignRoutes = (
  app: FastifyInstance,
  useCases: DesignRoutesUseCases,
): void => {
  app.get('/api/round-catalog', () => roundCatalog);

  app.get('/api/playlists/check', async (request, reply) => {
    const query = parseOr400(checkPlaylistQuerySchema, request.query, reply);
    if (!query) return reply;
    return sendResult(reply, await useCases.checkPlaylist.execute(query), toPlaylistSummaryDto);
  });

  /** Film and series lookup: slow and paid, hence reserved to the owner of a design. */
  app.get('/api/playlists/analyze', async (request, reply) => {
    const query = parseOr400(analyzePlaylistQuerySchema, request.query, reply);
    if (!query) return reply;
    const result = await useCases.analyzePlaylist.execute({
      designId: query.designId,
      editToken: bearerToken(request),
      playlist: query.playlist,
    });
    return sendResult(reply, result, toPlaylistAnalysisDto);
  });

  app.post('/api/designs', async (request, reply) => {
    const body = parseOr400(createGameDesignPayloadSchema, request.body, reply);
    if (!body) return reply;
    const result = await useCases.createGameDesign.execute(body);
    return sendResult(
      reply,
      result,
      ({ design, editToken }): CreateGameDesignResponseDto => ({
        design: toGameDesignDto(design),
        editToken,
      }),
      201,
    );
  });

  app.get<DesignParams>('/api/designs/:designId', async (request, reply) => {
    const access = { designId: request.params.designId, editToken: bearerToken(request) };
    return sendResult(reply, await useCases.getGameDesign.execute(access), toGameDesignDto);
  });

  app.put<DesignParams>('/api/designs/:designId', async (request, reply) => {
    const body = parseOr400(updateGameDesignPayloadSchema, request.body, reply);
    if (!body) return reply;
    const result = await useCases.updateGameDesign.execute({
      designId: request.params.designId,
      editToken: bearerToken(request),
      ...body,
    });
    return sendResult(reply, result, toGameDesignDto);
  });

  app.delete<DesignParams>('/api/designs/:designId', async (request, reply) => {
    const access = { designId: request.params.designId, editToken: bearerToken(request) };
    const result = await useCases.deleteGameDesign.execute(access);
    return result.ok ? reply.status(204).send() : sendResult(reply, result, () => null);
  });
};
