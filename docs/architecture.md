# Architecture

## Overview

**Vocabulary.** A host prepares a **game design** in advance: an ordered list of **round plans**
(round type + adjustable rules + Deezer playlist). Launching it creates a **game** (the live party,
joined with a code). Each **round** plays several **songs** (a random unplayed track of its
playlist); players send **answers**, checked automatically and correctable by the host; the host
**reveals** each song, which publishes the scores.

```
 Browser (host)          Browser (player)
   │  HTTP  POST /api/games    │
   │  Socket.IO ───────────────┤
   ▼                           ▼
┌───────────── apps/server ─────────────────────────────────────┐
│ infrastructure/primary   Fastify routes · Socket.IO handlers  │  ← driving adapters
│        │ (zod-validated payloads, DTO mapping)                │
│        ▼                                                      │
│ application              use cases + ports (in / out)         │
│        │                                                      │
│        ▼                                                      │
│ domain                   Game aggregate, Round, Player, VOs   │  ← pure TypeScript
│        ▲                                                      │
│ infrastructure/secondary repository · clock · ids · publisher │  ← driven adapters
└───────────────────────────────────────────────────────────────┘
```

### Layers (server)

| Layer                | Contains                                                                                                                                                                                                                         | May import                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `domain/`            | `design/` (`GameDesign`, `RoundPlan`, `RoundRules` + presets), `game/` (`Game` root, `Round`, `Song`, `Answer`, `scoring`), `music/` (`PlaylistId`, `Track`, `answerMatching`), `Result`                                         | nothing                            |
| `application/`       | one class per use case; **ports/in** (what adapters may call) and **ports/out** (`GameRepository`, `GameDesignRepository`, `MusicCatalog`, `Clock`, `IdGenerator`, `RandomGenerator`, `GameCodeGenerator`, `GameEventPublisher`) | `domain`                           |
| `infrastructure/`    | primary adapters (HTTP, sockets), secondary adapters (SQLite design repo, in-memory game repo, Deezer catalog, system clock, Socket.IO publisher), DTO mappers                                                                   | `application`, `domain`, libraries |
| `compositionRoot.ts` | wires concrete adapters into use cases (manual DI)                                                                                                                                                                               | everything                         |

These rules are enforced by `pnpm depcruise` (`.dependency-cruiser.cjs`) in CI.

### Conventions

- **Expected failures are values**: use cases return `Result<T, UseCaseError>`; exceptions mean bugs.
  Error codes travel to clients unchanged (`GAME_NOT_FOUND`, `PLAYER_NAME_TAKEN`, …).
- **Validate at the edge**: primary adapters parse payloads with the Zod schemas from `@ubt/shared`;
  the domain still enforces its own invariants.
- **DTOs only on the wire**: domain objects are mapped in `infrastructure/mappers`.
- **Players never see other players' answers**: `PlayerSessionDto` only carries `myAnswer`.

## Real-time & timestamping

- Designs are managed over HTTP (`/api/designs`, edit token sent as `Authorization: Bearer`),
  with `/api/round-catalog` (presets and limits) and `/api/playlists/check`. `POST /api/games`
  launches a design and returns the host token.
- Every client opens one Socket.IO connection. A socket identifies itself with `host:attach`
  or `player:join` / `player:rejoin`; the server stores that session on `socket.data` and puts the
  socket in rooms (`game:<id>`, `game:<id>:hosts`, `game:<id>:player:<playerId>`).
- Commands use **acks** (request/response with `{ ok, data | error }`): `song:next`, `song:reveal`,
  `answer:judge`, `game:finish`, `answer:submit`. Server pushes use events (`song:started` to
  players, `host:song-started` with the preview to hosts, `answer:received`, `answer:judged`,
  `song:revealed`, `scoreboard:updated`, `game:finished`). Contracts live in `packages/shared/src/events.ts`.
- **Secrecy**: players never get the preview URL; title and artist leave the server only at the
  reveal (the host does not know the answer either). Players only see scores of revealed songs.
- **The server clock is authoritative.** `SubmitAnswer` reads `Clock.now()` _first_, before any I/O.
  `SystemClock` uses `performance.timeOrigin + performance.now()`: monotonic and sub-millisecond,
  immune to NTP jumps. `elapsedMs = receivedAt − round.startedAt`. The client's `clientSentAt` is
  stored for diagnostics only (client clocks drift and can be tampered with).
- Clients re-identify on every `connect` (`useOnConnect`), so a phone going to sleep or a page
  refresh resumes the game (session kept in `sessionStorage`).

> Fairness note: `receivedAt` includes each player's network latency. If that becomes an issue, a
> future iteration can measure per-socket RTT (ping/ack) and compensate, still server-side.

## Web

```
src/app/        router + providers (QueryClient, RealtimeProvider)
src/features/   home · host · player — pages, hooks, feature components
src/shared/     api (HTTP) · realtime (GameGateway port, socket adapter, hooks) · session · ui · lib
```

Components never touch socket.io directly: they use the `GameGateway` interface
(`shared/realtime/gameGateway.ts`) and `useSocketEvent`. Tests swap the gateway for a fake
(`src/test/renderWithRealtime.tsx`). Pure state transitions (e.g. `hostGameReducer`) are kept out
of components to be unit tested.

## Adding a feature (recipe)

1. Domain: model the rule in the aggregate + unit test.
2. Application: add/extend a use case and its port in `ports/in`; new outside needs → new port in `ports/out`.
3. Contracts: add payload schema / DTO / event in `@ubt/shared`.
4. Infrastructure: handler or route + mapper; new driven adapter if a port was added; wire it in `compositionRoot.ts`.
5. Web: gateway method → hook → components.
6. Integration test in `apps/server/test/integration`.

## Known limits of the starter

- Designs are stored in SQLite (`node:sqlite`, `DATABASE_PATH`); live games are in memory: single
  server instance, running parties lost on restart. Swap `InMemoryGameRepository` for a Redis/SQL
  adapter and add `@socket.io/redis-adapter` to scale out.
- No accounts: a design is owned by whoever holds its edit token (kept in the host's
  localStorage).
- Deezer previews are 30 s excerpts chosen by Deezer; their signed URLs expire after ~15 minutes.
- The in-memory repository returns live aggregates; a persistent adapter will need optimistic
  concurrency (version field) for concurrent answers.
