import { createAppServer } from './compositionRoot';
import { loadConfig } from './config/env';

const config = loadConfig();
const server = await createAppServer(config);

const shutdown = async (signal: string) => {
  server.http.log.info({ signal }, 'Shutting down');
  await server.stop();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await server.start();
