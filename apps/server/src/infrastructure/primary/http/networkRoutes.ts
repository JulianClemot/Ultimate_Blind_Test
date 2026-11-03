import { networkInterfaces } from 'node:os';

import type { FastifyInstance } from 'fastify';

/** Non-internal IPv4 addresses of this machine, so a phone on the same Wi-Fi can reach it. */
export const lanAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flatMap((infos) => infos ?? [])
    .filter((info) => info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);

export const registerNetworkRoutes = (app: FastifyInstance): void => {
  app.get('/api/network', () => ({ addresses: lanAddresses() }));
};
