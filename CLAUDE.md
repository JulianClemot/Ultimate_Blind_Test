# Ultimate Blind Test — project guide

Real-time blind test app. pnpm monorepo: `apps/server` (Fastify + Socket.IO, hexagonal),
`apps/web` (React 19 + Vite), `packages/shared` (contracts). Read `docs/architecture.md` first.

## Commands

- `pnpm dev` — server :3000 + web :5173 (Vite proxies `/api` and `/socket.io`)
- `pnpm verify` — lint, format check, typecheck, depcruise, tests, build (run before declaring done)
- `pnpm --filter @ubt/server test` / `pnpm --filter @ubt/web test`
- Node 24 (`.nvmrc`). TypeScript is pinned to 6.0 because typescript-eslint does not support TS 7 yet.

## Rules

- Server layers: `domain` imports nothing; `application` imports only `domain`; only
  `compositionRoot.ts` wires `infrastructure`. `pnpm depcruise` must pass.
- Use cases return `Result`, never throw for business errors. One use case per class, depending on ports.
- Validate inbound payloads with Zod schemas from `@ubt/shared` in primary adapters.
- Answer timestamps come from the server `Clock` port only, read before any I/O.
- Never send other players' answers to a player.
- Web: components use `GameGateway` / `useSocketEvent`, never socket.io directly. Keep state
  transitions in pure reducers with unit tests.
- TDD: domain/use-case tests with doubles in `apps/server/test/doubles`; add an integration test in
  `apps/server/test/integration` for every new socket event.
- Conventional Commits (enforced by commitlint).
