# ADR 0002 — Socket.IO for real time

- Status: accepted
- Date: 2026-11-03

## Context

Hosts and players exchange low-latency events; players are often on phones with flaky networks.

## Decision

Socket.IO 4 with typed events shared through `@ubt/shared`, acks for commands, rooms per game,
and the server clock as the single source of truth for answer timestamps.

## Consequences

- Rooms, reconnection, acks and timeouts come for free; Redis adapter available for scaling.
- Clients must use the Socket.IO client (not a raw WebSocket).
