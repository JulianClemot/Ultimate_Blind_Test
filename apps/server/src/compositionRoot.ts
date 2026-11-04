import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';

import {
  AttachHost,
  AutoRevealSong,
  CheckPlaylist,
  CreateGameDesign,
  DeleteGameDesign,
  FinishGame,
  GetGameDesign,
  JoinGame,
  JudgeAnswer,
  LaunchGame,
  NextSong,
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

  const useCases = {
    createGameDesign: new CreateGameDesign(designs, ids, clock),
    getGameDesign: new GetGameDesign(designs),
    updateGameDesign: new UpdateGameDesign(designs, clock, catalog),
    deleteGameDesign: new DeleteGameDesign(designs),
    checkPlaylist: new CheckPlaylist(catalog),
    launchGame: new LaunchGame(designs, games, ids, codes, clock),
    attachHost: new AttachHost(games),
    joinGame: new JoinGame(games, ids, clock, events),
    rejoinGame: new RejoinGame(games),
    nextSong: new NextSong(games, ids, clock, events, catalog, random),
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
