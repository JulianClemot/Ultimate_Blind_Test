import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';

import {
  AnalyzePlaylist,
  AttachHost,
  AutoRevealSong,
  CheckPlaylist,
  CreateGameDesign,
  DeleteGameDesign,
  FinishGame,
  GenerateTeams,
  GetGameDesign,
  JoinGame,
  JudgeAnswer,
  LaunchGame,
  NextSong,
  PlaylistAnalyzer,
  RejoinGame,
  RevealSong,
  SubmitAnswer,
  UpdateGameDesign,
} from './application';
import type { AppConfig } from './config/env';
import { registerDesignRoutes } from './infrastructure/primary/http/designRoutes';
import { registerGameRoutes } from './infrastructure/primary/http/gameRoutes';
import { registerHealthRoutes } from './infrastructure/primary/http/healthRoutes';
import { registerNetworkRoutes } from './infrastructure/primary/http/networkRoutes';
import { registerSocketHandlers } from './infrastructure/primary/socket/registerSocketHandlers';
import type { GameServer } from './infrastructure/realtime/types';
import { SocketIoGameEventPublisher } from './infrastructure/secondary/events/SocketIoGameEventPublisher';
import { CryptoIdGenerator } from './infrastructure/secondary/id/CryptoIdGenerator';
import { RandomGameCodeGenerator } from './infrastructure/secondary/id/RandomGameCodeGenerator';
import { DeezerMusicCatalog } from './infrastructure/secondary/music/DeezerMusicCatalog';
import { InMemoryGameRepository } from './infrastructure/secondary/persistence/InMemoryGameRepository';
import { SqliteGameDesignRepository } from './infrastructure/secondary/persistence/SqliteGameDesignRepository';
import { CryptoRandomGenerator } from './infrastructure/secondary/random/CryptoRandomGenerator';
import { ClaudeSourceResolver } from './infrastructure/secondary/sources/ClaudeSourceResolver';
import { MetadataSourceResolver } from './infrastructure/secondary/sources/MetadataSourceResolver';
import { SystemClock } from './infrastructure/secondary/time/SystemClock';
import { SystemScheduler } from './infrastructure/secondary/time/SystemScheduler';

export interface AppServer {
  readonly http: FastifyInstance;
  readonly io: GameServer;
  /** Starts listening and resolves with the bound address (e.g. http://127.0.0.1:3000). */
  start(): Promise<string>;
  stop(): Promise<void>;
}

/**
 * Composition root: the only place that knows about concrete adapters.
 * Everything else depends on ports (Dependency Inversion Principle).
 */
export const createAppServer = async (config: AppConfig): Promise<AppServer> => {
  const http = Fastify({ logger: { level: config.LOG_LEVEL } });
  await http.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  const io: GameServer = new Server(http.server, { cors: { origin: config.CORS_ORIGIN } });

  const designs = new SqliteGameDesignRepository(config.DATABASE_PATH);
  const games = new InMemoryGameRepository();
  const ids = new CryptoIdGenerator();
  const codes = new RandomGameCodeGenerator();
  const clock = new SystemClock();
  const events = new SocketIoGameEventPublisher(io);
  const catalog = new DeezerMusicCatalog(config.DEEZER_API_URL);
  const random = new CryptoRandomGenerator();
  const scheduler = new SystemScheduler((error) =>
    http.log.error({ err: error }, 'scheduled task failed'),
  );
  const autoRevealSong = new AutoRevealSong(games, clock, events);
  const anthropic = config.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 90_000 })
    : undefined;
  const sourceResolver = anthropic
    ? new ClaudeSourceResolver(
        (params) => anthropic.messages.create(params),
        config.SOURCE_LOOKUP_MODEL ?? 'claude-opus-5-5',
        (error) => http.log.warn({ err: error }, 'film and series lookup failed'),
      )
    : new MetadataSourceResolver();
  const analyzer = new PlaylistAnalyzer(sourceResolver, catalog);

  const useCases = {
    createGameDesign: new CreateGameDesign(designs, ids, clock),
    getGameDesign: new GetGameDesign(designs),
    updateGameDesign: new UpdateGameDesign(designs, clock, catalog),
    deleteGameDesign: new DeleteGameDesign(designs),
    checkPlaylist: new CheckPlaylist(catalog),
    analyzePlaylist: new AnalyzePlaylist(designs, catalog, analyzer),
    launchGame: new LaunchGame(designs, games, ids, codes, clock, analyzer),
    attachHost: new AttachHost(games),
    generateTeams: new GenerateTeams(games, random, events),
    joinGame: new JoinGame(games, ids, clock, events),
    rejoinGame: new RejoinGame(games),
    nextSong: new NextSong(games, ids, clock, events, catalog, random, analyzer),
    revealSong: new RevealSong(games, clock, events),
    judgeAnswer: new JudgeAnswer(games, events),
    finishGame: new FinishGame(games, events),
    submitAnswer: new SubmitAnswer(games, ids, clock, events, scheduler, autoRevealSong),
  };

  registerHealthRoutes(http);
  registerNetworkRoutes(http);
  registerDesignRoutes(http, useCases);
  registerGameRoutes(http, useCases);
  registerSocketHandlers(io, useCases, http.log);

  http.addHook('preClose', (done) => {
    io.disconnectSockets(true);
    io.engine.close();
    done();
  });
  http.addHook('onClose', (_instance, done) => {
    designs.close();
    done();
  });

  return {
    http,
    io,
    start: () => http.listen({ host: config.HOST, port: config.PORT }),
    stop: () => http.close(),
  };
};
