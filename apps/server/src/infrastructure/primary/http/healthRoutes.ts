import type { FastifyInstance } from 'fastify';

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get('/api/health', () => ({ status: 'ok' }));
};
