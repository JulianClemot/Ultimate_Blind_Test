# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ---- base: Node + pnpm (version pinned by "packageManager" in package.json) -------------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm \
  PATH=/pnpm:$PATH \
  HUSKY=0 \
  CI=true
RUN corepack enable
WORKDIR /app

# ---- deps: install the whole workspace (cached until a manifest or the lockfile changes) -----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile

# ---- build: bundle the server (tsup) and the web app (vite) ----------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN pnpm --filter @ubt/server build && pnpm --filter @ubt/web build

# ---- server-deps: production-only node_modules for the server --------------------------------
FROM build AS server-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm --filter @ubt/server deploy --prod /out

# ---- server: runtime image -------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS server
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  DATABASE_PATH=/data/ubt.sqlite
WORKDIR /app
COPY --from=server-deps --chown=node:node /out/node_modules ./node_modules
COPY --from=server-deps --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/server/dist ./dist
# SQLite file (game designs) lives here: mount a volume to keep it across restarts.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ---- web: nginx serving the static build and proxying the API --------------------------------
FROM nginx:1-alpine AS web
ENV SERVER_URL=http://server:3000
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
